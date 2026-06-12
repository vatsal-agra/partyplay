"use client"

import { motion } from "framer-motion"
import Image from "next/image"

import { Game } from "@/app/types"

type GameCardProps = {
  game: Game
  onPlay: () => void
  isInParty: boolean
  isCreatingParty: boolean
}

export function GameCard({ 
  game, 
  onPlay, 
  isInParty, 
  isCreatingParty 
}: GameCardProps) {
  // const { id } = game; // No longer needed for conditional styling

  const imageClasses = [
    'w-full',
    'h-full',
    'object-cover',
    'object-top' // Apply to all images
  ].filter(Boolean).join(' ');
  const { name, description, minPlayers, maxPlayers, image, complexity, duration } = game
  return (
    <motion.div
      whileHover={{ y: -5 }}
      whileTap={{ scale: 0.98 }}
      className="relative overflow-hidden rounded-xl border-2 border-gray-200 dark:border-gray-700 transition-all duration-300 cursor-pointer hover:border-accent/50"
    >
      <div className="aspect-video relative bg-gray-100 dark:bg-gray-800">
        <div className="w-full h-full flex items-center justify-center">
          <Image
            src={image}
            alt={name}
            width={300}
            height={200}
            className={imageClasses}
            onError={(e) => {
              console.error(`Error loading image for ${name} at path ${image}. Event:`, e);
              // Fallback to a placeholder image if the main image fails to load
              const target = e.target as HTMLImageElement;
              target.onerror = null; // Prevent infinite loop if placeholder also fails
              target.src = `https://via.placeholder.com/300x200/1f2937/ffffff?text=${encodeURIComponent(name)}`;
            }}
            priority
          />
        </div>
        {isInParty && (
          <div className="absolute top-2 right-2 bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-full">
            In Party
          </div>
        )}
      </div>
      <div className="p-4">
        <div className="flex justify-between items-start gap-2">
          <h3 className="font-bold text-lg text-foreground">{name}</h3>
          <div className="flex flex-col items-end">
            <span className="text-sm text-white font-medium bg-cyan-500/30 px-2 py-1 rounded-full whitespace-nowrap">
              {minPlayers}-{maxPlayers} players
            </span>
            <span className="text-xs text-white/80 mt-1">
              {duration}
            </span>
          </div>
        </div>
        <p className="mt-2 text-sm text-white/90 line-clamp-2 mb-3">
          {description}
        </p>
        <div className="flex justify-between items-center">
          <span className="text-xs bg-pink-500/30 text-white font-medium px-2 py-1 rounded-full">
            {complexity} complexity
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPlay();
            }}
            disabled={isCreatingParty}
            className={`px-4 py-2 rounded-lg font-medium text-sm shadow-lg ${
              isInParty
                ? 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white'
                : 'bg-gradient-to-r from-cyan-500 to-pink-500 hover:from-cyan-600 hover:to-pink-600 text-white'
            } transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {isCreatingParty ? 'Creating...' : isInParty ? 'Join Party' : 'Play Now'}
          </button>
        </div>
      </div>
    </motion.div>
  )
}
