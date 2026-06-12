// Property Title Deed & Chance/Community Chest Card View Component
"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Space, PropertyState, BOARD_SPACES } from "../lib/monopolyEngine"
import { Sparkles, HelpCircle, Gift } from "lucide-react"
import { PropertyGroupIllustration } from "./PropertyGroupIllustration"

interface PropertyCardViewProps {
  space: Space;
  propertyState?: PropertyState;
  onClose: () => void;
  isCardDraw?: boolean;
  cardText?: string;
  cardType?: 'CHANCE' | 'COMMUNITY_CHEST';
}

export function PropertyCardView({ space, propertyState, onClose, isCardDraw = false, cardText, cardType }: PropertyCardViewProps) {
  const [isFlipped, setIsFlipped] = useState(false)

  // Mapping HSL colors for Monopoly groups
  const getColorGroupClass = (group: string) => {
    switch (group) {
      case 'BROWN': return 'bg-amber-950 text-amber-50'
      case 'LIGHT_BLUE': return 'bg-sky-400 text-sky-950'
      case 'PINK': return 'bg-pink-400 text-pink-950'
      case 'ORANGE': return 'bg-orange-500 text-orange-950'
      case 'RED': return 'bg-red-500 text-red-50'
      case 'YELLOW': return 'bg-yellow-400 text-yellow-950'
      case 'GREEN': return 'bg-emerald-600 text-emerald-50'
      case 'DARK_BLUE': return 'bg-blue-800 text-blue-50'
      default: return 'bg-slate-700 text-white'
    }
  }

  // Rent displays helper
  const renderRentRow = (label: string, value: number, highlight: boolean = false) => {
    return (
      <div className={`flex justify-between items-center text-xs py-1 border-b border-white/5 ${highlight ? 'text-pink-400 font-bold bg-white/5 px-2 rounded' : 'text-slate-300'}`}>
        <span>{label}</span>
        <span className="font-semibold">${value}</span>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      {/* Overlay click closes */}
      <div className="absolute inset-0" onClick={onClose} />

      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="relative z-[110] w-full max-w-xs sm:max-w-sm"
      >
        {isCardDraw ? (
          // Chance / Community Chest Card (3D Flip Animation)
          <div 
            className="w-full h-80 cursor-pointer"
            onClick={() => setIsFlipped(!isFlipped)}
            style={{ perspective: "1000px" }}
          >
            <div
              className="relative w-full h-full duration-700 transform-gpu"
              style={{
                transformStyle: "preserve-3d",
                transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)"
              }}
            >
              {/* Card Backside */}
              <div 
                className="absolute inset-0 rounded-2xl p-6 flex flex-col justify-between items-center border border-white/20 shadow-2xl"
                style={{
                  backfaceVisibility: "hidden",
                  background: cardType === 'CHANCE' 
                    ? 'linear-gradient(135deg, #ec4899, #f43f5e)' 
                    : 'linear-gradient(135deg, #06b6d4, #3b82f6)'
                }}
              >
                <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center animate-pulse">
                  {cardType === 'CHANCE' ? <HelpCircle className="w-8 h-8 text-white" /> : <Gift className="w-8 h-8 text-white" />}
                </div>
                <div className="text-center">
                  <h3 className="text-2xl font-black tracking-widest text-white uppercase drop-shadow-md">
                    {cardType === 'CHANCE' ? 'CHANCE' : 'COMMUNITY CHEST'}
                  </h3>
                  <p className="text-xs text-white/75 mt-1 font-mono">Click to reveal card</p>
                </div>
                <div className="w-full border-t border-white/20 pt-2 text-center text-[10px] text-white/50 font-mono">
                  PartyPlay Classic Edition
                </div>
              </div>

              {/* Card Frontside */}
              <div 
                className="absolute inset-0 rounded-2xl p-6 flex flex-col justify-between bg-slate-900 border border-yellow-500/30 shadow-2xl"
                style={{
                  backfaceVisibility: "hidden",
                  transform: "rotateY(180deg)",
                  boxShadow: `0 0 25px rgba(234, 179, 8, 0.15)`
                }}
              >
                {/* Gold outline border */}
                <div className="absolute inset-2 border border-yellow-500/20 rounded-xl pointer-events-none" />

                <div className="flex justify-between items-center z-10">
                  <span className={`text-xs font-mono font-bold uppercase ${cardType === 'CHANCE' ? 'text-pink-400' : 'text-cyan-400'}`}>
                    {cardType === 'CHANCE' ? 'Chance' : 'Community Chest'}
                  </span>
                  <Sparkles className="w-4 h-4 text-yellow-500 animate-spin" style={{ animationDuration: '3s' }} />
                </div>

                <div className="flex-1 flex flex-col justify-center items-center px-4 py-2 z-10">
                  <p className="text-white text-base font-serif font-medium text-center leading-relaxed italic">
                    "{cardText}"
                  </p>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onClose();
                  }}
                  className="w-full py-2 bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-600 hover:to-amber-600 text-slate-950 font-bold text-xs uppercase rounded-lg shadow-lg tracking-wider transition duration-200 z-10 text-center"
                >
                  Confirm Card Action
                </button>
              </div>
            </div>
          </div>
        ) : (
          // Classic Title Deed Property Card
          <div className="bg-slate-950 rounded-2xl border border-white/10 shadow-2xl p-4 max-h-[85vh] overflow-y-auto flex flex-col scrollbar-thin select-none">
            {/* Rich Property Group Artwork */}
            <div className="w-full h-24 rounded-xl mb-3 overflow-hidden relative border border-white/5 bg-slate-900 flex items-center justify-center flex-shrink-0">
              <PropertyGroupIllustration group={space.group} name={space.name} />
            </div>

            {/* Header / Stripe */}
            <div className={`rounded-xl p-2 text-center ${getColorGroupClass(space.group)} relative overflow-hidden shadow-md mb-3 flex-shrink-0`}>
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
              <span className="text-[9px] uppercase font-bold tracking-widest opacity-85 block mb-0.5">Title Deed</span>
              <h3 className="text-sm font-black uppercase tracking-wide">{space.name}</h3>
            </div>

            {/* Rent details */}
            <div className="space-y-1.5 py-1 px-1">
              {space.rents && (
                <>
                  {renderRentRow('Base Rent', space.rents[0], (propertyState?.houses === 0 && !propertyState?.isMortgaged))}
                  {renderRentRow('Rent with 1 House', space.rents[1], propertyState?.houses === 1)}
                  {renderRentRow('Rent with 2 Houses', space.rents[2], propertyState?.houses === 2)}
                  {renderRentRow('Rent with 3 Houses', space.rents[3], propertyState?.houses === 3)}
                  {renderRentRow('Rent with 4 Houses', space.rents[4], propertyState?.houses === 4)}
                  {renderRentRow('Rent with Hotel', space.rents[5], propertyState?.houses === 5)}
                </>
              )}

              {space.type === 'RAILROAD' && (
                <>
                  {renderRentRow('1 Railroad Owned', 25)}
                  {renderRentRow('2 Railroads Owned', 50)}
                  {renderRentRow('3 Railroads Owned', 100)}
                  {renderRentRow('4 Railroads Owned', 200)}
                </>
              )}

              {space.type === 'UTILITY' && (
                <div className="text-xs text-slate-300 py-2 leading-relaxed border-b border-white/5">
                  If 1 Utility is owned, rent is <span className="text-yellow-400 font-bold">4 times</span> value shown on dice.<br />
                  If both Utilities are owned, rent is <span className="text-yellow-400 font-bold">10 times</span> value shown on dice.
                </div>
              )}
            </div>

            {/* Build Costs and Mortgaging */}
            <div className="mt-4 pt-3 border-t border-white/15 grid grid-cols-2 gap-3 text-center bg-white/5 rounded-xl p-3">
              <div>
                <span className="text-[10px] text-slate-400 block uppercase tracking-wider">House Cost</span>
                <span className="text-sm font-black text-white">${space.houseCost || 'N/A'}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block uppercase tracking-wider">Mortgage Value</span>
                <span className="text-sm font-black text-white">${space.mortgageValue || 'N/A'}</span>
              </div>
            </div>

            {/* Close button */}
            <button
              onClick={onClose}
              className="w-full mt-4 py-2 bg-white/10 hover:bg-white/20 text-white font-bold text-xs uppercase rounded-lg tracking-wider transition duration-200"
            >
              Close Card Info
            </button>
          </div>
        )}
      </motion.div>
    </div>
  )
}
