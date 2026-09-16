"use client"

import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import Image from "next/image"
import Link from "next/link"
import { Gamepad2, Users, MessageSquare, Zap, Trophy, Vote, Sparkles, ArrowRight, Mic } from "lucide-react"
import { GAMES_CATALOG, gamePath } from "@/lib/games-catalog"
import { FloatingPieces } from "@/components/FloatingPieces"
import { LandingJsonLd } from "@/components/LandingJsonLd"

const fadeIn = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
}

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.12 } },
}

const GAME_COUNT = GAMES_CATALOG.length

const features = [
  { icon: Users, color: "text-grape-300", glow: "group-hover:shadow-glow-grape", title: "Instant Parties", description: "Spin up a game room in seconds and pull friends in with a single share code." },
  { icon: Vote, color: "text-bubble-400", glow: "group-hover:shadow-glow-bubble", title: "Vote To Play", description: "Can't agree on a game? Everyone votes, the crowd favourite wins, and it launches for the whole party at once." },
  { icon: Gamepad2, color: "text-aqua-400", glow: "group-hover:shadow-glow-aqua", title: `All ${GAME_COUNT} Games Playable`, description: "Every game in the library is finished and live today: property trading, naval battles, hex settlements, card duels, poker, a murder mystery, two drawing races and word spying." },
  { icon: Mic, color: "text-sunny-400", glow: "group-hover:shadow-glow-sunny", title: "Voice And Live Chat", description: "Talk over built-in voice chat or type in the party. Trash talk included, no second app required." },
  { icon: Zap, color: "text-grape-300", glow: "group-hover:shadow-glow-grape", title: "Zero Installs", description: "No downloads, no setup. It runs in your browser and syncs everyone instantly." },
  { icon: Trophy, color: "text-bubble-400", glow: "group-hover:shadow-glow-bubble", title: "Game On", description: "Climb the leaderboard, track your wins, and earn bragging rights for the group chat." },
]

const steps = [
  { step: "1", title: "Create a party", body: "One click makes a room and a six character code. No setup, no lobby wrangling." },
  { step: "2", title: "Share the code", body: "Drop the code or invite link in the group chat. Friends can join as guests without signing up." },
  { step: "3", title: "Vote and play", body: `Everyone picks from the ${GAME_COUNT} games, and the winner launches for the whole party at once.` },
]

export default function Home() {
  const router = useRouter()
  const [currentImageIndex, setCurrentImageIndex] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % GAMES_CATALOG.length)
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  return (
    <main className="relative min-h-screen overflow-hidden">
      <LandingJsonLd />
      {/* Hero */}
      <section className="relative">
        <FloatingPieces />
        <div className="container relative z-10 mx-auto px-4 pt-16 pb-20 lg:pt-24">
          <motion.div
            className="flex flex-col lg:flex-row items-center justify-between gap-14"
            initial="hidden"
            animate="visible"
            variants={staggerContainer}
          >
            {/* Left */}
            <motion.div className="flex-1 text-center lg:text-left" variants={fadeIn}>
              <motion.div
                variants={fadeIn}
                className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-sm text-grape-100 backdrop-blur-sm"
              >
                <Sparkles className="h-4 w-4 text-sunny-400" />
                Your virtual game night HQ
              </motion.div>

              <motion.h1
                className="font-display text-5xl sm:text-6xl lg:text-7xl font-bold leading-[1.05] tracking-tight"
                variants={fadeIn}
              >
                <span className="text-white">Game night,</span>
                <br />
                <span className="text-gradient">anywhere.</span>
              </motion.h1>

              <motion.p
                className="mt-6 text-lg text-muted-foreground max-w-xl mx-auto lg:mx-0"
                variants={fadeIn}
              >
                Create a party, send one code to your friends, and{" "}
                <span className="text-white font-medium">vote on what to play</span>. All{" "}
                <span className="text-white font-medium">{GAME_COUNT} games are finished and playable right now</span>,
                live in your browser.
              </motion.p>

              {/* Above-fold CTAs. Real anchors (asChild) so they are crawlable
                  and open in a new tab on middle click, not router.push only. */}
              <motion.div className="mt-9 flex flex-col sm:flex-row gap-4 justify-center lg:justify-start" variants={fadeIn}>
                <Button asChild variant="brand" size="lg" className="gap-2">
                  <Link href="/dashboard/create-party">
                    Start a party
                    <ArrowRight className="h-5 w-5" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link href="/auth/sign-in">Play as guest</Link>
                </Button>
              </motion.div>

              <motion.p className="mt-4 text-sm text-muted-foreground" variants={fadeIn}>
                Free forever. Guests just pick a name, no account and no card.{" "}
                <Link href="/games" className="font-medium text-white underline underline-offset-4 hover:text-grape-200">
                  See all {GAME_COUNT} games
                </Link>
              </motion.p>

              <motion.div className="mt-8 flex flex-wrap items-center gap-6 justify-center lg:justify-start text-sm text-muted-foreground" variants={fadeIn}>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-mint-500 animate-pulse" />
                  Free to play
                </div>
                <div className="flex items-center gap-2">
                  <Gamepad2 className="h-4 w-4 text-aqua-400" />
                  {GAME_COUNT} games, all live
                </div>
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-sunny-400" />
                  Voice and chat built in
                </div>
              </motion.div>
            </motion.div>

            {/* Right: game showcase, rotating straight through the live catalog */}
            <motion.div
              className="flex-1 relative w-full"
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.2 }}
            >
              <div className="relative h-[380px] w-full max-w-[480px] mx-auto">
                <div className="absolute -inset-6 bg-brand opacity-20 blur-3xl rounded-full" />
                {GAMES_CATALOG.map((game, index) => (
                  <motion.div
                    key={game.id}
                    className="absolute inset-0 rounded-3xl overflow-hidden border border-white/10 shadow-soft"
                    initial={false}
                    animate={{
                      opacity: index === currentImageIndex ? 1 : 0,
                      scale: index === currentImageIndex ? 1 : 0.92,
                      zIndex: index === currentImageIndex ? 10 : 0,
                    }}
                    transition={{ duration: 0.7, ease: "easeInOut" }}
                  >
                    <Image
                      src={game.image}
                      alt={game.name}
                      fill
                      sizes="(max-width: 768px) 90vw, 480px"
                      style={{ objectFit: "cover" }}
                      priority={index === 0}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-background/85 via-transparent to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-center gap-2 p-5">
                      <span className="rounded-full bg-mint-500/25 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-white ring-1 ring-mint-500/50">
                        Playable now
                      </span>
                      <span className="font-display text-lg font-bold text-white drop-shadow">{game.name}</span>
                    </div>
                  </motion.div>
                ))}

                <motion.div
                  className="absolute -bottom-6 -right-4 z-20 grid place-items-center rounded-2xl bg-brand p-5 shadow-glow-grape"
                  animate={{ y: [0, -12, 0], rotate: [0, 6, 0, -6, 0] }}
                  transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                >
                  <Gamepad2 className="h-9 w-9 text-white" />
                </motion.div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* The catalog. Rendered straight from GAMES_CATALOG so this section can
          never go stale when a game is added to or pulled from the store. */}
      <motion.section
        className="relative border-t border-white/10 py-20"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.1 }}
        variants={staggerContainer}
      >
        <div className="container mx-auto px-4">
          <motion.div className="text-center mb-12" variants={fadeIn}>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-mint-500/40 bg-mint-500/10 px-4 py-1.5 text-sm font-semibold text-white">
              <span className="h-2 w-2 rounded-full bg-mint-500 animate-pulse" />
              Live now
            </div>
            <h2 className="font-display text-4xl font-bold text-white">
              {GAME_COUNT} games, <span className="text-gradient">ready to play tonight</span>
            </h2>
            <p className="mt-3 text-muted-foreground max-w-2xl mx-auto">
              This is not a roadmap. Every one of these is finished, multiplayer, and running in your browser today.
            </p>
          </motion.div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {GAMES_CATALOG.map((game) => (
              <motion.div key={game.id} variants={fadeIn}>
                <Link
                  href={gamePath(game.id)}
                  className="group glass card-hover block overflow-hidden hover:border-white/20"
                >
                  <div className="relative aspect-[4/3] overflow-hidden">
                    <Image
                      src={game.image}
                      alt={game.name}
                      fill
                      sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 18vw"
                      style={{ objectFit: "cover" }}
                      className="transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
                  </div>
                  <div className="p-3">
                    <h3 className="truncate text-sm font-bold text-white">{game.name}</h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {game.minPlayers}-{game.maxPlayers} players
                    </p>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>

          <motion.div className="mt-10 flex flex-col sm:flex-row justify-center gap-4" variants={fadeIn}>
            <Button variant="brand" size="lg" className="gap-2" onClick={() => router.push("/dashboard/create-party")}>
              Create a party
              <ArrowRight className="h-5 w-5" />
            </Button>
            <Button variant="outline" size="lg" onClick={() => router.push("/games")}>
              Browse the full library
            </Button>
          </motion.div>
        </div>
      </motion.section>

      {/* Features */}
      <motion.section
        className="relative border-y border-white/10 bg-white/[0.02] py-20"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.2 }}
        variants={staggerContainer}
      >
        <div className="container mx-auto px-4">
          <motion.div className="text-center mb-14" variants={fadeIn}>
            <h2 className="font-display text-4xl font-bold text-white">
              Everything for the <span className="text-gradient">perfect game night</span>
            </h2>
            <p className="mt-3 text-muted-foreground max-w-2xl mx-auto">
              Built for friends and families who&apos;d rather play together than scroll apart.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature) => (
              <motion.div
                key={feature.title}
                className="group glass card-hover p-6 hover:border-white/20"
                variants={fadeIn}
              >
                <div className={`mb-4 inline-grid place-items-center rounded-xl bg-white/5 p-3 ring-1 ring-white/10 transition-shadow ${feature.glow}`}>
                  <feature.icon className={`h-7 w-7 ${feature.color}`} />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">{feature.title}</h3>
                <p className="text-muted-foreground">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.section>

      {/* How it works: three steps, so the CTA reads as no work at all */}
      <motion.section
        className="relative py-20"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.2 }}
        variants={staggerContainer}
      >
        <div className="container mx-auto px-4">
          <motion.h2 className="font-display text-4xl font-bold text-white text-center mb-12" variants={fadeIn}>
            Playing takes <span className="text-gradient">about a minute</span>
          </motion.h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {steps.map((s) => (
              <motion.div key={s.step} className="glass card-hover p-6" variants={fadeIn}>
                <span className="mb-4 inline-grid h-10 w-10 place-items-center rounded-full bg-brand font-display text-lg font-bold text-white">
                  {s.step}
                </span>
                <h3 className="text-xl font-bold text-white mb-2">{s.title}</h3>
                <p className="text-muted-foreground">{s.body}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.section>

      {/* CTA */}
      <motion.section
        className="relative pb-24"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        variants={staggerContainer}
      >
        <div className="container mx-auto px-4">
          <motion.div
            variants={fadeIn}
            className="relative overflow-hidden rounded-3xl border border-white/10 bg-brand-soft p-10 sm:p-16 text-center"
          >
            <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-grape-500/30 blur-3xl" />
            <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-bubble-500/20 blur-3xl" />
            <div className="relative">
              <h2 className="font-display text-4xl sm:text-5xl font-bold text-white mb-4">
                Your next game night starts now
              </h2>
              <p className="text-lg text-white/80 mb-9 max-w-2xl mx-auto">
                Make a party, paste the code into the group chat, and be playing one of {GAME_COUNT} games before
                anyone finishes arguing about what to watch.
              </p>
              <div className="flex flex-col sm:flex-row justify-center gap-4">
                <Button variant="brand" size="lg" className="gap-2" onClick={() => router.push("/dashboard/create-party")}>
                  Start a free game night
                  <ArrowRight className="h-5 w-5" />
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="border-white/30 text-white hover:bg-white/10"
                  onClick={() => router.push("/games")}
                >
                  See all {GAME_COUNT} games
                </Button>
              </div>
              <p className="mt-6 text-sm text-white/70">
                Free to play. No card, no download, and nothing for your friends to install.
              </p>
            </div>
          </motion.div>
        </div>
      </motion.section>
    </main>
  )
}
