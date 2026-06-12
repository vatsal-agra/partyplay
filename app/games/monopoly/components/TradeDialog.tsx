// Trade Dialog Component
"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { Player, PropertyState, BOARD_SPACES, Space } from "../lib/monopolyEngine"
import { X, ArrowRightLeft, DollarSign } from "lucide-react"

interface TradeDialogProps {
  players: Player[];
  currentPlayerId: string;
  properties: { [key: number]: PropertyState };
  onClose: () => void;
  onPropose: (receiverId: string, offerCash: number, offerProps: number[], requestCash: number, requestProps: number[]) => void;
}

export function TradeDialog({ players, currentPlayerId, properties, onClose, onPropose }: TradeDialogProps) {
  const otherPlayers = players.filter(p => p.id !== currentPlayerId && !p.isBankrupt)
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>(otherPlayers[0]?.id || "")

  const [offerCash, setOfferCash] = useState<number>(0)
  const [offerProps, setOfferProps] = useState<number[]>([])

  const [requestCash, setRequestCash] = useState<number>(0)
  const [requestProps, setRequestProps] = useState<number[]>([])

  const currentPlayer = players.find(p => p.id === currentPlayerId)!
  const targetPlayer = players.find(p => p.id === selectedPlayerId)

  // Get properties owned by a specific player
  const getPlayerProperties = (playerId: string) => {
    return Object.entries(properties)
      .filter(([idx, pState]) => pState.ownerId === playerId && pState.houses === 0) // Houses must be sold before trading in standard rules
      .map(([idx]) => BOARD_SPACES[parseInt(idx)])
  }

  const currentPlayerProps = getPlayerProperties(currentPlayerId)
  const targetPlayerProps = selectedPlayerId ? getPlayerProperties(selectedPlayerId) : []

  const handleToggleProp = (index: number, isOffer: boolean) => {
    if (isOffer) {
      setOfferProps(prev =>
        prev.includes(index) ? prev.filter(x => x !== index) : [...prev, index]
      )
    } else {
      setRequestProps(prev =>
        prev.includes(index) ? prev.filter(x => x !== index) : [...prev, index]
      )
    }
  }

  const handleProposeTrade = () => {
    if (!selectedPlayerId) return
    onPropose(selectedPlayerId, offerCash, offerProps, requestCash, requestProps)
    onClose()
  }

  const getGroupColor = (group: string) => {
    switch (group) {
      case 'BROWN': return 'bg-amber-800'
      case 'LIGHT_BLUE': return 'bg-sky-400'
      case 'PINK': return 'bg-pink-400'
      case 'ORANGE': return 'bg-orange-500'
      case 'RED': return 'bg-red-500'
      case 'YELLOW': return 'bg-yellow-400'
      case 'GREEN': return 'bg-emerald-600'
      case 'DARK_BLUE': return 'bg-blue-800'
      default: return 'bg-slate-600'
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      {/* Overlay click closes */}
      <div className="absolute inset-0" onClick={onClose} />

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative z-10 w-full max-w-2xl bg-slate-900 border border-white/10 rounded-2xl p-6 shadow-2xl flex flex-col max-h-[85vh]"
      >
        {/* Header */}
        <div className="flex justify-between items-center pb-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5 text-pink-400 animate-pulse" />
            <h2 className="text-lg font-black uppercase text-white tracking-wide">Propose Trade Deal</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Player Selector */}
        <div className="my-4">
          <label className="text-xs font-bold text-slate-400 uppercase block mb-1">Select Opponent to Trade With</label>
          <select
            value={selectedPlayerId}
            onChange={(e) => {
              setSelectedPlayerId(e.target.value)
              setRequestProps([])
              setRequestCash(0)
            }}
            className="w-full bg-slate-950 border border-white/[0.15] hover:border-white/30 text-white rounded-lg p-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-pink-500"
          >
            {otherPlayers.map(p => (
              <option key={p.id} value={p.id}>{p.name} (Cash: ${p.cash})</option>
            ))}
          </select>
        </div>

        {/* Trade Columns */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6 overflow-y-auto pr-1 my-2 min-h-0">
          {/* Your Offer */}
          <div className="flex flex-col bg-slate-950/50 p-4 rounded-xl border border-white/5">
            <h3 className="text-xs font-black uppercase text-pink-400 tracking-wide mb-3 flex items-center gap-1">
              Your Offer
            </h3>

            {/* Cash Input */}
            <div className="mb-4">
              <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Offer Cash</label>
              <div className="relative">
                <DollarSign className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="number"
                  min="0"
                  max={currentPlayer.cash}
                  value={offerCash}
                  onChange={(e) => setOfferCash(Math.min(currentPlayer.cash, Math.max(0, parseInt(e.target.value) || 0)))}
                  className="w-full bg-slate-950 pl-8 pr-3 py-2 text-sm border border-white/10 rounded-lg text-white focus:outline-none focus:border-pink-500"
                />
              </div>
              <span className="text-[9px] text-slate-500 mt-1 block">Max available: ${currentPlayer.cash}</span>
            </div>

            {/* Property Selector */}
            <div className="flex-1 flex flex-col">
              <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Offer Properties</label>
              {currentPlayerProps.length === 0 ? (
                <div className="text-center py-6 text-xs text-slate-500 italic bg-slate-950 rounded-lg">
                  No tradable properties (sell houses first)
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-1">
                  {currentPlayerProps.map(space => {
                    const isSelected = offerProps.includes(space.index)
                    const isMortgaged = properties[space.index]?.isMortgaged
                    return (
                      <div
                        key={space.index}
                        onClick={() => handleToggleProp(space.index, true)}
                        className={`flex items-center justify-between p-2 rounded-lg cursor-pointer border select-none transition ${
                          isSelected ? 'bg-white/5 border-pink-500' : 'bg-slate-950 border-white/5 hover:border-white/10'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span className={`w-3 h-3 rounded-full flex-shrink-0 ${getGroupColor(space.group)}`} />
                          <span className="text-xs text-white font-medium truncate flex-1">{space.name}</span>
                          {isMortgaged && (
                            <span className="text-[7px] bg-red-500/20 text-red-400 px-1 py-0.5 rounded font-black uppercase tracking-widest flex-shrink-0 border border-red-500/25 font-mono">MORTGAGED</span>
                          )}
                        </div>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          readOnly
                          className="rounded text-pink-500 focus:ring-0 bg-slate-800 flex-shrink-0 ml-2"
                        />
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Your Request */}
          <div className="flex flex-col bg-slate-950/50 p-4 rounded-xl border border-white/5">
            <h3 className="text-xs font-black uppercase text-cyan-400 tracking-wide mb-3 flex items-center gap-1">
              Your Request
            </h3>

            {/* Cash Input */}
            <div className="mb-4">
              <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Request Cash</label>
              <div className="relative">
                <DollarSign className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="number"
                  min="0"
                  max={targetPlayer?.cash || 0}
                  value={requestCash}
                  onChange={(e) => setRequestCash(Math.min(targetPlayer?.cash || 0, Math.max(0, parseInt(e.target.value) || 0)))}
                  className="w-full bg-slate-950 pl-8 pr-3 py-2 text-sm border border-white/10 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
              <span className="text-[9px] text-slate-500 mt-1 block">Max available: ${targetPlayer?.cash || 0}</span>
            </div>

            {/* Property Selector */}
            <div className="flex-1 flex flex-col">
              <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Request Properties</label>
              {targetPlayerProps.length === 0 ? (
                <div className="text-center py-6 text-xs text-slate-500 italic bg-slate-950 rounded-lg">
                  No tradable properties
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-1">
                  {targetPlayerProps.map(space => {
                    const isSelected = requestProps.includes(space.index)
                    const isMortgaged = properties[space.index]?.isMortgaged
                    return (
                      <div
                        key={space.index}
                        onClick={() => handleToggleProp(space.index, false)}
                        className={`flex items-center justify-between p-2 rounded-lg cursor-pointer border select-none transition ${
                          isSelected ? 'bg-white/5 border-cyan-500' : 'bg-slate-950 border-white/5 hover:border-white/10'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span className={`w-3 h-3 rounded-full flex-shrink-0 ${getGroupColor(space.group)}`} />
                          <span className="text-xs text-white font-medium truncate flex-1">{space.name}</span>
                          {isMortgaged && (
                            <span className="text-[7px] bg-red-500/20 text-red-400 px-1 py-0.5 rounded font-black uppercase tracking-widest flex-shrink-0 border border-red-500/25 font-mono">MORTGAGED</span>
                          )}
                        </div>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          readOnly
                          className="rounded text-cyan-500 focus:ring-0 bg-slate-800 flex-shrink-0 ml-2"
                        />
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Action button */}
        <div className="pt-4 border-t border-white/10 mt-2 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-white/10 hover:bg-white/5 text-white font-bold text-xs uppercase rounded-lg transition"
          >
            Cancel
          </button>
          <button
            onClick={handleProposeTrade}
            disabled={!selectedPlayerId || (offerCash === 0 && offerProps.length === 0 && requestCash === 0 && requestProps.length === 0)}
            className="px-6 py-2 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-500 text-slate-950 font-black text-xs uppercase rounded-lg shadow-lg tracking-wider transition"
          >
            Propose Trade Offer
          </button>
        </div>
      </motion.div>
    </div>
  )
}
