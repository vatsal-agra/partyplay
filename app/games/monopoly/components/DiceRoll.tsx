// Premium 2D Animated Dice Roll Component
"use client"

import { useState, useEffect } from "react"
import { motion, useAnimation } from "framer-motion"

interface DiceRollProps {
  dice: [number, number];
  isRolling: boolean;
  onRollComplete?: () => void;
  playerColor?: string;
}

const DIE_FACES: Record<number, number[][]> = {
  1: [[0.5, 0.5]],
  2: [[0.25, 0.25], [0.75, 0.75]],
  3: [[0.25, 0.25], [0.5, 0.5], [0.75, 0.75]],
  4: [[0.25, 0.25], [0.25, 0.75], [0.75, 0.25], [0.75, 0.75]],
  5: [[0.25, 0.25], [0.25, 0.75], [0.5, 0.5], [0.75, 0.25], [0.75, 0.75]],
  6: [[0.25, 0.25], [0.25, 0.5], [0.25, 0.75], [0.75, 0.25], [0.75, 0.5], [0.75, 0.75]]
};

export function DiceRoll({ dice, isRolling, onRollComplete, playerColor = "#ec4899" }: DiceRollProps) {
  const [displayDice, setDisplayDice] = useState<[number, number]>(dice);
  const controls1 = useAnimation();
  const controls2 = useAnimation();

  useEffect(() => {
    if (isRolling) {
      // Shaking loop
      const rollInterval = setInterval(() => {
        setDisplayDice([
          Math.floor(Math.random() * 6) + 1,
          Math.floor(Math.random() * 6) + 1
        ]);
      }, 80);

      const shakeAnimation = {
        x: [0, -8, 8, -6, 6, -8, 8, 0],
        y: [0, 6, -8, 8, -6, 8, -6, 0],
        rotate: [0, -15, 15, -10, 10, -15, 15, 0],
        scale: [1, 0.95, 1.05, 0.95, 1.05, 0.95, 1.05, 1],
      };

      controls1.start({
        ...shakeAnimation,
        transition: { duration: 0.8, ease: "easeInOut" }
      });
      controls2.start({
        ...shakeAnimation,
        transition: { duration: 0.8, ease: "easeInOut", delay: 0.05 }
      });

      const timer = setTimeout(() => {
        clearInterval(rollInterval);
        setDisplayDice(dice);
        
        // Settle with bounce
        controls1.start({
          scale: 1,
          rotate: 0,
          transition: { type: "spring", stiffness: 200, damping: 12 }
        });
        controls2.start({
          scale: 1,
          rotate: 0,
          transition: { type: "spring", stiffness: 200, damping: 12, delay: 0.05 }
        });

        if (onRollComplete) {
          onRollComplete();
        }
      }, 800);

      return () => {
        clearInterval(rollInterval);
        clearTimeout(timer);
      };
    } else {
      setDisplayDice(dice);
    }
  }, [isRolling, dice, onRollComplete, controls1, controls2]);

  const renderDie = (val: number, controls: any) => {
    const pips = DIE_FACES[val] || DIE_FACES[1];
    return (
      <motion.div
        animate={controls}
        className="relative w-16 h-16 bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700/60 rounded-2xl shadow-xl flex items-center justify-center cursor-default select-none"
        style={{
          boxShadow: `inset 0 2px 4px rgba(255,255,255,0.05), 0 10px 25px -5px ${playerColor}22, 0 0 12px ${playerColor}15`
        }}
      >
        <div className="relative w-full h-full">
          {pips.map(([x, y], idx) => (
            <motion.div
              key={idx}
              className="absolute w-3 h-3 rounded-full shadow-inner"
              style={{
                left: `${x * 100}%`,
                top: `${y * 100}%`,
                transform: 'translate(-50%, -50%)',
                backgroundColor: playerColor,
                boxShadow: `0 0 8px ${playerColor}`
              }}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 15 }}
            />
          ))}
        </div>
      </motion.div>
    );
  };

  const isDouble = dice[0] === dice[1] && dice[0] > 0;
  const total = displayDice[0] + displayDice[1];

  return (
    <div className="flex flex-col items-center justify-center py-2 px-4 select-none">
      <div className="flex gap-6 justify-center items-center">
        {renderDie(displayDice[0], controls1)}
        {renderDie(displayDice[1], controls2)}
      </div>

      <div className="mt-3 flex flex-col items-center justify-center min-h-[40px]">
        {/* Total display with count animation */}
        {!isRolling && total > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-slate-300 font-mono font-black text-xs bg-slate-900/60 border border-white/5 px-2.5 py-0.5 rounded-full shadow-sm"
          >
            TOTAL: {total}
          </motion.div>
        )}

        {/* Doubles tag */}
        {!isRolling && isDouble && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-[10px] font-black tracking-widest text-pink-400 bg-pink-500/10 border border-pink-500/20 px-3 py-1 rounded-full uppercase mt-1.5 shadow-[0_0_15px_rgba(236,72,153,0.15)] animate-pulse"
          >
            🎉 Doubles! Roll Again!
          </motion.div>
        )}
      </div>
    </div>
  );
}
