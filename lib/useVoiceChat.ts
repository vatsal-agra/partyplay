"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { RealtimeChannel } from "@supabase/supabase-js"

// ----------------------------------------------------------------------------
// Voice chat over a WebRTC full mesh, signalled through a dedicated Supabase
// Realtime channel.
//
//   * Presence tracks who is in the voice room (reliable join/leave + roster).
//   * Broadcast carries the SDP offers/answers and ICE candidates.
//   * Google STUN handles NAT discovery; an optional TURN relay (set via
//     NEXT_PUBLIC_TURN_* env vars) covers the minority behind strict NATs.
//
// Glare is avoided with a deterministic rule: for any pair, only the peer with
// the lexicographically smaller id creates the offer. Audio-only means the
// connection is negotiated exactly once, so renegotiation glare can't occur
// (mute is a local track.enabled toggle, not a renegotiation).
//
// Mesh is intended for small rooms (≤ ~8). That matches every game here.
// ----------------------------------------------------------------------------

export interface VoiceParticipant {
  userId: string
  speaking: boolean
  muted: boolean
  connected: boolean
}

interface SignalMsg {
  to: string
  from: string
  sdp?: RTCSessionDescriptionInit
  candidate?: RTCIceCandidateInit
}

const SPEAKING_THRESHOLD = 0.012
const MAX_PEERS = 8

function iceServers(): RTCIceServer[] {
  const servers: RTCIceServer[] = [
    { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
  ]
  const turnUrl = process.env.NEXT_PUBLIC_TURN_URL
  if (turnUrl) {
    // Your own TURN relay (recommended for production).
    servers.push({
      urls: turnUrl,
      username: process.env.NEXT_PUBLIC_TURN_USERNAME,
      credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL,
    })
  } else {
    // Free public TURN fallback (Metered OpenRelay) so audio still relays
    // across strict NATs / firewalls without any setup. STUN alone fails on a
    // large fraction of real networks — which is why a mic can be "speaking"
    // locally yet never reach the other peer. Swap in your own TURN via the
    // NEXT_PUBLIC_TURN_* env vars for production reliability.
    servers.push(
      { urls: "turn:openrelay.metered.ca:80", username: "openrelayproject", credential: "openrelayproject" },
      { urls: "turn:openrelay.metered.ca:443", username: "openrelayproject", credential: "openrelayproject" },
      { urls: "turn:openrelay.metered.ca:443?transport=tcp", username: "openrelayproject", credential: "openrelayproject" }
    )
  }
  return servers
}

export function useVoiceChat(opts: {
  client: SupabaseClient
  roomId: string | null
  userId: string | null
  enabled: boolean
}) {
  const { client, roomId, userId, enabled } = opts

  const [joined, setJoined] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [muted, setMuted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selfSpeaking, setSelfSpeaking] = useState(false)
  const [participants, setParticipants] = useState<Record<string, VoiceParticipant>>({})

  // Mutable internals (read inside long-lived channel/RTC callbacks).
  const channelRef = useRef<RealtimeChannel | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map())
  const audioElsRef = useRef<Map<string, HTMLAudioElement>>(new Map())
  const pendingIceRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map())
  const mutedRef = useRef(false)
  const joinedRef = useRef(false)

  // Speaking detection.
  const audioCtxRef = useRef<AudioContext | null>(null)
  const analysersRef = useRef<Map<string, AnalyserNode>>(new Map())
  const speakingRef = useRef<Map<string, boolean>>(new Map())
  const meterRafRef = useRef<number | null>(null)
  const makeOfferRef = useRef<((peerId: string) => void) | null>(null)
  const unlockArmedRef = useRef(false)
  const unlockCleanupRef = useRef<(() => void) | null>(null)

  // Keep a ref of participants so we can mutate-then-publish without stale reads.
  const participantsRef = useRef<Record<string, VoiceParticipant>>({})
  const publishParticipants = useCallback(() => {
    setParticipants({ ...participantsRef.current })
  }, [])

  const upsertParticipant = useCallback(
    (id: string, patch: Partial<VoiceParticipant>) => {
      const prev = participantsRef.current[id] || { userId: id, speaking: false, muted: false, connected: false }
      const next = { ...prev, ...patch }
      if (prev.speaking === next.speaking && prev.muted === next.muted && prev.connected === next.connected && participantsRef.current[id]) {
        return
      }
      participantsRef.current = { ...participantsRef.current, [id]: next }
      publishParticipants()
    },
    [publishParticipants]
  )

  const removeParticipant = useCallback(
    (id: string) => {
      if (!participantsRef.current[id]) return
      const next = { ...participantsRef.current }
      delete next[id]
      participantsRef.current = next
      publishParticipants()
    },
    [publishParticipants]
  )

  // ---- Speaking meter -------------------------------------------------------
  const attachAnalyser = useCallback((id: string, stream: MediaStream) => {
    try {
      if (!audioCtxRef.current) {
        const Ctx = window.AudioContext || (window as any).webkitAudioContext
        audioCtxRef.current = new Ctx()
      }
      const ctx = audioCtxRef.current!
      // Some browsers start the context suspended until a user gesture; join()
      // is one, so resuming here keeps the speaking meter alive.
      if (ctx.state === "suspended") ctx.resume().catch(() => {})
      const src = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 512
      src.connect(analyser)
      analysersRef.current.set(id, analyser)
    } catch {
      /* analyser is best-effort; voice still works without the meter */
    }
  }, [])

  const startMeter = useCallback(() => {
    if (meterRafRef.current != null) return
    const buf = new Uint8Array(256)
    let last = 0
    const tick = (t: number) => {
      // ~15 Hz is plenty for a speaking indicator.
      if (t - last > 66) {
        last = t
        analysersRef.current.forEach((analyser, id) => {
          analyser.getByteTimeDomainData(buf)
          let sum = 0
          for (let i = 0; i < buf.length; i++) {
            const v = (buf[i] - 128) / 128
            sum += v * v
          }
          const rms = Math.sqrt(sum / buf.length)
          const speaking = rms > SPEAKING_THRESHOLD
          if (speakingRef.current.get(id) !== speaking) {
            speakingRef.current.set(id, speaking)
            if (id === "self") setSelfSpeaking(speaking && !mutedRef.current)
            else upsertParticipant(id, { speaking })
          }
        })
      }
      meterRafRef.current = requestAnimationFrame(tick)
    }
    meterRafRef.current = requestAnimationFrame(tick)
  }, [upsertParticipant])

  // If the browser blocks programmatic audio playback, resume everything on the
  // next user interaction (a tap/keypress is a valid gesture).
  const armAutoplayUnlock = useCallback(() => {
    if (unlockArmedRef.current) return
    unlockArmedRef.current = true
    const resume = () => {
      audioCtxRef.current?.resume?.().catch(() => {})
      audioElsRef.current.forEach((el) => { el.play().catch(() => {}) })
    }
    document.addEventListener("pointerdown", resume)
    document.addEventListener("keydown", resume)
    unlockCleanupRef.current = () => {
      document.removeEventListener("pointerdown", resume)
      document.removeEventListener("keydown", resume)
      unlockArmedRef.current = false
    }
  }, [])

  // ---- Peer connection management ------------------------------------------
  const sendSignal = useCallback((event: string, payload: SignalMsg) => {
    channelRef.current?.send({ type: "broadcast", event, payload })
  }, [])

  const getOrCreatePeer = useCallback(
    (peerId: string): RTCPeerConnection => {
      const existing = peersRef.current.get(peerId)
      if (existing) return existing
      if (peersRef.current.size >= MAX_PEERS) {
        // Soft cap: don't blow up the mesh; just don't connect beyond the cap.
        return existing as any
      }

      const pc = new RTCPeerConnection({ iceServers: iceServers() })
      peersRef.current.set(peerId, pc)
      upsertParticipant(peerId, { connected: false })

      // Send our mic to the peer.
      const stream = localStreamRef.current
      if (stream) stream.getTracks().forEach((track) => pc.addTrack(track, stream))

      pc.onicecandidate = (e) => {
        if (e.candidate && userId) {
          sendSignal("ice", { to: peerId, from: userId, candidate: e.candidate.toJSON() })
        }
      }

      pc.ontrack = (e) => {
        const [remoteStream] = e.streams
        if (!remoteStream) return
        let el = audioElsRef.current.get(peerId)
        if (!el) {
          el = document.createElement("audio")
          el.autoplay = true
          ;(el as any).playsInline = true
          el.style.display = "none"
          document.body.appendChild(el)
          audioElsRef.current.set(peerId, el)
        }
        el.srcObject = remoteStream
        el.volume = 1
        el.play().catch(() => armAutoplayUnlock())
        attachAnalyser(peerId, remoteStream)
        startMeter()
      }

      pc.onconnectionstatechange = () => {
        const st = pc.connectionState
        if (st === "connected") upsertParticipant(peerId, { connected: true })
        else if (st === "failed" || st === "closed") upsertParticipant(peerId, { connected: false })
      }

      pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === "failed") {
          // The deterministic initiator recovers the link with an ICE restart.
          if (userId && userId < peerId) {
            try { pc.restartIce?.() } catch { /* older browsers */ }
            makeOfferRef.current?.(peerId)
          }
        }
      }

      return pc
    },
    [userId, sendSignal, upsertParticipant, attachAnalyser, startMeter, armAutoplayUnlock]
  )

  const closePeer = useCallback((peerId: string) => {
    const pc = peersRef.current.get(peerId)
    if (pc) {
      pc.onicecandidate = null
      pc.ontrack = null
      pc.onconnectionstatechange = null
      pc.oniceconnectionstatechange = null
      try { pc.close() } catch { /* noop */ }
      peersRef.current.delete(peerId)
    }
    const el = audioElsRef.current.get(peerId)
    if (el) {
      el.srcObject = null
      el.remove()
      audioElsRef.current.delete(peerId)
    }
    analysersRef.current.delete(peerId)
    speakingRef.current.delete(peerId)
    pendingIceRef.current.delete(peerId)
    removeParticipant(peerId)
  }, [removeParticipant])

  const flushPendingIce = useCallback(async (peerId: string, pc: RTCPeerConnection) => {
    const queued = pendingIceRef.current.get(peerId)
    if (!queued?.length) return
    pendingIceRef.current.set(peerId, [])
    for (const c of queued) {
      try { await pc.addIceCandidate(new RTCIceCandidate(c)) } catch { /* ignore */ }
    }
  }, [])

  const makeOffer = useCallback(async (peerId: string) => {
    const pc = getOrCreatePeer(peerId)
    if (!pc || !userId) return
    try {
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      sendSignal("offer", { to: peerId, from: userId, sdp: offer })
    } catch (e) {
      console.warn("voice: makeOffer failed", e)
    }
  }, [getOrCreatePeer, userId, sendSignal])

  // Expose makeOffer to the (earlier-defined) ICE-restart handler without a
  // declaration cycle.
  useEffect(() => { makeOfferRef.current = makeOffer }, [makeOffer])

  // ---- Join / leave ---------------------------------------------------------
  const cleanup = useCallback(() => {
    joinedRef.current = false
    if (meterRafRef.current != null) { cancelAnimationFrame(meterRafRef.current); meterRafRef.current = null }
    peersRef.current.forEach((_, id) => closePeer(id))
    peersRef.current.clear()
    audioElsRef.current.forEach((el) => { el.srcObject = null; el.remove() })
    audioElsRef.current.clear()
    analysersRef.current.clear()
    speakingRef.current.clear()
    pendingIceRef.current.clear()
    localStreamRef.current?.getTracks().forEach((t) => t.stop())
    localStreamRef.current = null
    if (channelRef.current) { client.removeChannel(channelRef.current); channelRef.current = null }
    if (audioCtxRef.current) { audioCtxRef.current.close().catch(() => {}); audioCtxRef.current = null }
    unlockCleanupRef.current?.()
    unlockCleanupRef.current = null
    participantsRef.current = {}
    setParticipants({})
    setSelfSpeaking(false)
    setJoined(false)
    setConnecting(false)
  }, [client, closePeer])

  const join = useCallback(async () => {
    if (!roomId || !userId || joinedRef.current || connecting) return
    setError(null)
    setConnecting(true)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: false,
      })
      localStreamRef.current = stream
      mutedRef.current = false
      setMuted(false)
      attachAnalyser("self", stream)
      startMeter()
      armAutoplayUnlock()

      const channel = client.channel(`voice:${roomId}`, {
        config: { presence: { key: userId }, broadcast: { self: false } },
      })
      channelRef.current = channel

      channel
        .on("broadcast", { event: "offer" }, async ({ payload }) => {
          const msg = payload as SignalMsg
          if (msg.to !== userId || !msg.sdp) return
          const pc = getOrCreatePeer(msg.from)
          if (!pc) return
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp))
            await flushPendingIce(msg.from, pc)
            const answer = await pc.createAnswer()
            await pc.setLocalDescription(answer)
            sendSignal("answer", { to: msg.from, from: userId, sdp: answer })
          } catch (e) {
            console.warn("voice: handling offer failed", e)
          }
        })
        .on("broadcast", { event: "answer" }, async ({ payload }) => {
          const msg = payload as SignalMsg
          if (msg.to !== userId || !msg.sdp) return
          const pc = peersRef.current.get(msg.from)
          if (!pc) return
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp))
            await flushPendingIce(msg.from, pc)
          } catch (e) {
            console.warn("voice: handling answer failed", e)
          }
        })
        .on("broadcast", { event: "ice" }, async ({ payload }) => {
          const msg = payload as SignalMsg
          if (msg.to !== userId || !msg.candidate) return
          const pc = peersRef.current.get(msg.from)
          if (pc && pc.remoteDescription) {
            try { await pc.addIceCandidate(new RTCIceCandidate(msg.candidate)) } catch { /* ignore */ }
          } else {
            // Remote description not set yet — buffer until it is.
            const q = pendingIceRef.current.get(msg.from) || []
            q.push(msg.candidate)
            pendingIceRef.current.set(msg.from, q)
          }
        })
        .on("presence", { event: "sync" }, () => {
          const state = channel.presenceState() as Record<string, Array<{ muted?: boolean }>>
          const present = Object.keys(state)
          // Connect to / track everyone present besides us.
          present.forEach((peerId) => {
            if (peerId === userId) return
            const peerMuted = !!state[peerId]?.[0]?.muted
            upsertParticipant(peerId, { muted: peerMuted })
            if (!peersRef.current.has(peerId)) {
              getOrCreatePeer(peerId)
              // Deterministic initiator: smaller id offers.
              if (userId < peerId) makeOffer(peerId)
            }
          })
          // Drop peers who left.
          peersRef.current.forEach((_, peerId) => {
            if (!present.includes(peerId)) closePeer(peerId)
          })
        })
        .subscribe(async (status) => {
          if (status === "SUBSCRIBED") {
            await channel.track({ userId, muted: false })
            joinedRef.current = true
            setJoined(true)
            setConnecting(false)
          }
        })
    } catch (e: any) {
      const name = e?.name
      setError(
        name === "NotAllowedError" || name === "SecurityError"
          ? "Microphone access was blocked. Allow mic access to join voice."
          : name === "NotFoundError"
          ? "No microphone found."
          : "Couldn't start voice chat."
      )
      cleanup()
    }
  }, [roomId, userId, connecting, client, attachAnalyser, startMeter, getOrCreatePeer, flushPendingIce, sendSignal, makeOffer, upsertParticipant, closePeer, cleanup, armAutoplayUnlock])

  const leave = useCallback(() => {
    cleanup()
  }, [cleanup])

  const toggleMute = useCallback(() => {
    const stream = localStreamRef.current
    if (!stream) return
    const next = !mutedRef.current
    mutedRef.current = next
    setMuted(next)
    stream.getAudioTracks().forEach((t) => { t.enabled = !next })
    if (next) setSelfSpeaking(false)
    // Tell the room so others can show our muted state.
    channelRef.current?.track({ userId, muted: next })
  }, [userId])

  // Tear down on unmount, when disabled, or when the room/identity changes.
  useEffect(() => {
    if (!enabled && joinedRef.current) cleanup()
  }, [enabled, cleanup])

  useEffect(() => {
    return () => { cleanup() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId])

  return { joined, connecting, muted, error, participants, selfSpeaking, join, leave, toggleMute }
}
