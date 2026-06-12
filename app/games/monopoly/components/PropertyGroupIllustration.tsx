// Thematic SVG Illustrations for Monopoly Property Groups
import React, { useId } from "react"

interface IllustrationProps {
  group: string
  name?: string
  mini?: boolean
}

export function PropertyGroupIllustration({ group, name = "", mini = false }: IllustrationProps) {
  const uniqueId = useId().replace(/:/g, "")
  // Common styles
  const baseSvgClass = "w-full h-full object-contain"

  // Mini renders simplified high-contrast icons for the board cells
  if (mini) {
    switch (group) {
      case "BROWN":
        return (
          <svg className={baseSvgClass} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 3L3 10V21H21V10L12 3Z" fill={`url(#brown-grad-${uniqueId})`} />
            <path d="M9 21V14H15V21H9Z" fill="#1e1e1e" />
            <rect x="11" y="7" width="2" height="3" fill="#fbbf24" />
            <defs>
              <linearGradient id={`brown-grad-${uniqueId}`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#d97706" />
                <stop offset="100%" stopColor="#451a03" />
              </linearGradient>
            </defs>
          </svg>
        )
      case "LIGHT_BLUE":
        return (
          <svg className={baseSvgClass} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L4 7V16L12 21L20 16V7L12 2Z" fill={`url(#lblue-grad-${uniqueId})`} />
            <path d="M12 6L6 9.75V14.25L12 18L18 14.25V9.75L12 6Z" fill="#0f172a" opacity="0.6" />
            <circle cx="12" cy="12" r="2" fill="#38bdf8" />
            <defs>
              <linearGradient id={`lblue-grad-${uniqueId}`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#38bdf8" />
                <stop offset="100%" stopColor="#0369a1" />
              </linearGradient>
            </defs>
          </svg>
        )
      case "PINK":
        return (
          <svg className={baseSvgClass} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" fill={`url(#pink-grad-${uniqueId})`} />
            <path d="M12 6C8.686 6 6 8.686 6 12C6 15.314 8.686 18 12 18L13 14H15L16 12L15 10H13L12 6Z" fill="#1e1b4b" />
            <circle cx="12" cy="12" r="3" fill="#f472b6" />
            <defs>
              <linearGradient id={`pink-grad-${uniqueId}`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#f472b6" />
                <stop offset="100%" stopColor="#9d174d" />
              </linearGradient>
            </defs>
          </svg>
        )
      case "ORANGE":
        return (
          <svg className={baseSvgClass} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="3" y="3" width="8" height="18" rx="1" fill={`url(#orange-grad-${uniqueId})`} />
            <rect x="13" y="7" width="8" height="14" rx="1" fill={`url(#orange-grad-${uniqueId})`} />
            <rect x="5" y="6" width="4" height="3" fill="#1e293b" />
            <rect x="15" y="10" width="4" height="3" fill="#1e293b" />
            <defs>
              <linearGradient id={`orange-grad-${uniqueId}`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#fb923c" />
                <stop offset="100%" stopColor="#c2410c" />
              </linearGradient>
            </defs>
          </svg>
        )
      case "RED":
        return (
          <svg className={baseSvgClass} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L2 22H22L12 2Z" fill={`url(#red-grad-${uniqueId})`} />
            <circle cx="12" cy="14" r="3" fill="#7f1d1d" />
            <path d="M12 9V12" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" />
            <defs>
              <linearGradient id={`red-grad-${uniqueId}`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#f87171" />
                <stop offset="100%" stopColor="#991b1b" />
              </linearGradient>
            </defs>
          </svg>
        )
      case "YELLOW":
        return (
          <svg className={baseSvgClass} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="9" fill={`url(#yellow-grad-${uniqueId})`} />
            <path d="M12 3V21M3 12H21M5.636 5.636L18.364 18.364M5.636 18.364L18.364 5.636" stroke="#78350f" strokeWidth="1.5" strokeLinecap="round" />
            <defs>
              <linearGradient id={`yellow-grad-${uniqueId}`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#fde047" />
                <stop offset="100%" stopColor="#b45309" />
              </linearGradient>
            </defs>
          </svg>
        )
      case "GREEN":
        return (
          <svg className={baseSvgClass} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2C8 7 4 10 4 15C4 19.4 7.6 22 12 22C16.4 22 20 19.4 20 15C20 10 16 7 12 2Z" fill={`url(#green-grad-${uniqueId})`} />
            <circle cx="12" cy="15" r="4" fill="#064e3b" />
            <defs>
              <linearGradient id={`green-grad-${uniqueId}`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#4ade80" />
                <stop offset="100%" stopColor="#047857" />
              </linearGradient>
            </defs>
          </svg>
        )
      case "DARK_BLUE":
        return (
          <svg className={baseSvgClass} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L2 9L12 16L22 9L12 2Z" fill={`url(#dblue-grad-${uniqueId})`} />
            <path d="M2 13L12 20L22 13" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M2 17L12 24L22 17" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <defs>
              <linearGradient id={`dblue-grad-${uniqueId}`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#60a5fa" />
                <stop offset="100%" stopColor="#1d4ed8" />
              </linearGradient>
            </defs>
          </svg>
        )
      case "RAILROAD":
        return (
          <svg className={baseSvgClass} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="2" y="7" width="20" height="10" rx="2" fill={`url(#rail-grad-${uniqueId})`} />
            <line x1="6" y1="7" x2="6" y2="17" stroke="#1c1917" strokeWidth="2" />
            <line x1="12" y1="7" x2="12" y2="17" stroke="#1c1917" strokeWidth="2" />
            <line x1="18" y1="7" x2="18" y2="17" stroke="#1c1917" strokeWidth="2" />
            <defs>
              <linearGradient id={`rail-grad-${uniqueId}`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#a8a29e" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#44403c" stopOpacity="0.9" />
              </linearGradient>
            </defs>
          </svg>
        )
      case "UTILITY":
        return (
          <svg className={baseSvgClass} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2C7.58 2 4 5.58 4 10C4 13.9 6.7 17.2 10.3 17.8L9 22H15L13.7 17.8C17.3 17.2 20 13.9 20 10C20 5.58 16.42 2 12 2Z" fill={`url(#util-grad-${uniqueId})`} />
            <circle cx="12" cy="10" r="4" fill="#1e1b4b" />
            <defs>
              <linearGradient id={`util-grad-${uniqueId}`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#a5b4fc" />
                <stop offset="100%" stopColor="#4338ca" />
              </linearGradient>
            </defs>
          </svg>
        )
      default:
        return null
    }
  }

  // Full detail vector illustrations for PropertyCardView deed headers
  switch (group) {
    case "BROWN":
      return (
        <div className="w-full h-full relative flex items-center justify-center bg-gradient-to-br from-slate-900 to-amber-950 p-2 overflow-hidden select-none">
          {/* Subtle Grid overlay */}
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:10px_10px]" />
          
          {/* Floating abstract cabin shapes */}
          <svg className="w-24 h-24 drop-shadow-[0_0_15px_rgba(217,119,6,0.3)]" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Ground */}
            <path d="M10 85H90" stroke="#78350f" strokeWidth="3" strokeLinecap="round" />
            {/* Cabin 1 */}
            <rect x="25" y="45" width="26" height="35" rx="2" fill="#78350f" stroke="#d97706" strokeWidth="2" />
            <polygon points="20,45 38,25 56,45" fill="#451a03" stroke="#d97706" strokeWidth="2" />
            <rect x="33" y="60" width="10" height="20" fill="#f59e0b" />
            {/* Cabin 2 */}
            <rect x="55" y="55" width="22" height="25" rx="2" fill="#451a03" stroke="#b45309" strokeWidth="2" />
            <polygon points="51,55 66,38 81,55" fill="#78350f" stroke="#b45309" strokeWidth="2" />
            <circle cx="66" cy="65" r="3" fill="#fde047" />
          </svg>
          
          <div className="absolute bottom-2 right-3 text-[9px] font-mono text-amber-500/70 tracking-wider">Old Town District</div>
        </div>
      )
    case "LIGHT_BLUE":
      return (
        <div className="w-full h-full relative flex items-center justify-center bg-gradient-to-br from-slate-900 to-sky-950 p-2 overflow-hidden select-none">
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:10px_10px]" />
          
          <svg className="w-24 h-24 drop-shadow-[0_0_15px_rgba(56,189,248,0.3)]" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Sea waves */}
            <path d="M10 80C30 75 40 85 60 80C80 75 90 85 90 85" stroke="#38bdf8" strokeWidth="3" strokeLinecap="round" />
            <path d="M15 85C30 82 45 88 70 83C80 81 90 86 90 86" stroke="#0284c7" strokeWidth="2" strokeLinecap="round" />
            {/* Lighthouse */}
            <path d="M40 80L45 35H55L60 80H40Z" fill="#e2e8f0" stroke="#0284c7" strokeWidth="2" />
            <rect x="44" y="30" width="12" height="6" fill="#38bdf8" />
            <path d="M42 30L50 15L58 30H42Z" fill="#0369a1" />
            <circle cx="50" cy="24" r="2.5" fill="#fef08a" className="animate-pulse" />
          </svg>
          
          <div className="absolute bottom-2 right-3 text-[9px] font-mono text-sky-400/70 tracking-wider">Seaside Waterfront</div>
        </div>
      )
    case "PINK":
      return (
        <div className="w-full h-full relative flex items-center justify-center bg-gradient-to-br from-slate-900 to-pink-950 p-2 overflow-hidden select-none">
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:10px_10px]" />
          
          <svg className="w-24 h-24 drop-shadow-[0_0_15px_rgba(244,114,182,0.35)]" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Theater sign */}
            <rect x="30" y="25" width="40" height="40" rx="4" fill="#1e1b4b" stroke="#f472b6" strokeWidth="2" />
            <rect x="34" y="29" width="32" height="32" fill="#db2777" opacity="0.3" />
            {/* Neon letters layout */}
            <path d="M38 45H62" stroke="#f472b6" strokeWidth="3" strokeLinecap="round" />
            <path d="M44 37L50 48L56 37" stroke="#f472b6" strokeWidth="2" />
            {/* Glow dots */}
            <circle cx="35" cy="30" r="1.5" fill="#fb7185" />
            <circle cx="65" cy="30" r="1.5" fill="#fb7185" />
            <circle cx="35" cy="60" r="1.5" fill="#fb7185" />
            <circle cx="65" cy="60" r="1.5" fill="#fb7185" />
            {/* Base poles */}
            <line x1="42" y1="65" x2="42" y2="85" stroke="#9d174d" strokeWidth="2" />
            <line x1="58" y1="65" x2="58" y2="85" stroke="#9d174d" strokeWidth="2" />
          </svg>
          
          <div className="absolute bottom-2 right-3 text-[9px] font-mono text-pink-400/70 tracking-wider">Theater & Arts Plaza</div>
        </div>
      )
    case "ORANGE":
      return (
        <div className="w-full h-full relative flex items-center justify-center bg-gradient-to-br from-slate-900 to-orange-950 p-2 overflow-hidden select-none">
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:10px_10px]" />
          
          <svg className="w-24 h-24 drop-shadow-[0_0_15px_rgba(251,146,60,0.35)]" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Skyline Buildings */}
            <rect x="15" y="50" width="18" height="35" rx="1" fill="#7c2d12" stroke="#ea580c" strokeWidth="2" />
            <rect x="38" y="25" width="24" height="60" rx="2" fill="#c2410c" stroke="#fb923c" strokeWidth="2" />
            <rect x="68" y="40" width="18" height="45" rx="1" fill="#7c2d12" stroke="#ea580c" strokeWidth="2" />
            {/* Windows in Center Building */}
            <rect x="44" y="32" width="4" height="6" fill="#fde047" />
            <rect x="52" y="32" width="4" height="6" fill="#fde047" />
            <rect x="44" y="44" width="4" height="6" fill="#fde047" />
            <rect x="52" y="44" width="4" height="6" fill="#fde047" />
            <rect x="44" y="56" width="4" height="6" fill="#fef08a" />
            <rect x="52" y="56" width="4" height="6" fill="#fef08a" />
          </svg>
          
          <div className="absolute bottom-2 right-3 text-[9px] font-mono text-orange-400/70 tracking-wider">Tycoon Square</div>
        </div>
      )
    case "RED":
      return (
        <div className="w-full h-full relative flex items-center justify-center bg-gradient-to-br from-slate-900 to-red-950 p-2 overflow-hidden select-none">
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:10px_10px]" />
          
          <svg className="w-24 h-24 drop-shadow-[0_0_15px_rgba(239,68,68,0.35)]" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Loft Art Studio */}
            <rect x="20" y="30" width="60" height="55" rx="3" fill="#450a0a" stroke="#ef4444" strokeWidth="2.5" />
            {/* Dome glass skylight */}
            <path d="M35 30C35 20 65 20 65 30" stroke="#f87171" strokeWidth="2" fill="none" />
            {/* Big loft windows */}
            <rect x="28" y="38" width="18" height="25" rx="1" fill="#7f1d1d" stroke="#f87171" strokeWidth="1.5" />
            <rect x="54" y="38" width="18" height="25" rx="1" fill="#7f1d1d" stroke="#f87171" strokeWidth="1.5" />
            <line x1="37" y1="38" x2="37" y2="63" stroke="#f87171" strokeWidth="1" />
            <line x1="63" y1="38" x2="63" y2="63" stroke="#f87171" strokeWidth="1" />
          </svg>
          
          <div className="absolute bottom-2 right-3 text-[9px] font-mono text-red-500/70 tracking-wider">Industrial Loft District</div>
        </div>
      )
    case "YELLOW":
      return (
        <div className="w-full h-full relative flex items-center justify-center bg-gradient-to-br from-slate-900 to-yellow-950 p-2 overflow-hidden select-none">
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:10px_10px]" />
          
          <svg className="w-24 h-24 drop-shadow-[0_0_15px_rgba(234,179,8,0.35)]" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Sun */}
            <circle cx="50" cy="30" r="16" fill={`url(#sun-grad-${uniqueId})`} />
            {/* Parasol umbrella */}
            <path d="M25 80L45 55L65 80" stroke="#d97706" strokeWidth="2" />
            <path d="M22 80H68" stroke="#ca8a04" strokeWidth="3.5" strokeLinecap="round" />
            <line x1="45" y1="55" x2="45" y2="80" stroke="#ca8a04" strokeWidth="2.5" />
            {/* Seagulls */}
            <path d="M20 25C23 23 25 26 28 24" stroke="#eab308" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M72 20C75 18 77 21 80 19" stroke="#eab308" strokeWidth="1.5" strokeLinecap="round" />
            <defs>
              <linearGradient id={`sun-grad-${uniqueId}`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#fef08a" />
                <stop offset="100%" stopColor="#ca8a04" />
              </linearGradient>
            </defs>
          </svg>
          
          <div className="absolute bottom-2 right-3 text-[9px] font-mono text-yellow-400/70 tracking-wider">Golden Boardwalk</div>
        </div>
      )
    case "GREEN":
      return (
        <div className="w-full h-full relative flex items-center justify-center bg-gradient-to-br from-slate-900 to-emerald-950 p-2 overflow-hidden select-none">
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:10px_10px]" />
          
          <svg className="w-24 h-24 drop-shadow-[0_0_15px_rgba(16,185,129,0.35)]" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Gate */}
            <path d="M20 85V45C20 30 80 30 80 45V85" stroke="#047857" strokeWidth="4" strokeLinecap="round" />
            <line x1="50" y1="30" x2="50" y2="85" stroke="#059669" strokeWidth="2" />
            {/* Embassy building inside */}
            <rect x="32" y="50" width="36" height="35" rx="1" fill="#064e3b" stroke="#10b981" strokeWidth="2" />
            {/* Columns */}
            <line x1="38" y1="55" x2="38" y2="80" stroke="#34d399" strokeWidth="2" />
            <line x1="50" y1="55" x2="50" y2="80" stroke="#34d399" strokeWidth="2" />
            <line x1="62" y1="55" x2="62" y2="80" stroke="#34d399" strokeWidth="2" />
          </svg>
          
          <div className="absolute bottom-2 right-3 text-[9px] font-mono text-emerald-400/70 tracking-wider">Botanical Embassy Avenue</div>
        </div>
      )
    case "DARK_BLUE":
      return (
        <div className="w-full h-full relative flex items-center justify-center bg-gradient-to-br from-slate-900 to-blue-950 p-2 overflow-hidden select-none">
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:10px_10px]" />
          
          <svg className="w-24 h-24 drop-shadow-[0_0_18px_rgba(59,130,246,0.5)]" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Luxury Penthouse Skyscraper */}
            <rect x="35" y="15" width="30" height="70" rx="3" fill="#1e3a8a" stroke="#60a5fa" strokeWidth="3" />
            {/* Diamond shape icon on tower */}
            <polygon points="50,25 57,35 50,45 43,35" fill="#93c5fd" />
            {/* Glowing windows */}
            <rect x="42" y="52" width="5" height="5" rx="1" fill="#bfdbfe" />
            <rect x="53" y="52" width="5" height="5" rx="1" fill="#bfdbfe" />
            <rect x="42" y="64" width="5" height="5" rx="1" fill="#bfdbfe" />
            <rect x="53" y="64" width="5" height="5" rx="1" fill="#bfdbfe" />
            <rect x="42" y="76" width="5" height="5" rx="1" fill="#bfdbfe" />
            <rect x="53" y="76" width="5" height="5" rx="1" fill="#bfdbfe" />
          </svg>
          
          <div className="absolute bottom-2 right-3 text-[9px] font-mono text-blue-400/80 tracking-wider">Park Place / Boardwalk Luxury</div>
        </div>
      )
    case "RAILROAD":
      return (
        <div className="w-full h-full relative flex items-center justify-center bg-gradient-to-br from-slate-900 to-stone-900 p-2 overflow-hidden select-none">
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:10px_10px]" />
          
          <svg className="w-24 h-24 drop-shadow-[0_0_15px_rgba(168,162,158,0.4)]" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Railway tracks */}
            <line x1="10" y1="80" x2="90" y2="80" stroke="#78716c" strokeWidth="4" />
            <line x1="20" y1="75" x2="20" y2="85" stroke="#78716c" strokeWidth="2" />
            <line x1="40" y1="75" x2="40" y2="85" stroke="#78716c" strokeWidth="2" />
            <line x1="60" y1="75" x2="60" y2="85" stroke="#78716c" strokeWidth="2" />
            <line x1="80" y1="75" x2="80" y2="85" stroke="#78716c" strokeWidth="2" />
            {/* Locomotive */}
            <rect x="30" y="40" width="45" height="30" rx="2" fill="#44403c" stroke="#a8a29e" strokeWidth="2.5" />
            <rect x="65" y="30" width="10" height="12" fill="#292524" stroke="#a8a29e" strokeWidth="1.5" />
            <circle cx="42" cy="70" r="7" fill="#1c1917" stroke="#d6d3d1" strokeWidth="1.5" />
            <circle cx="60" cy="70" r="7" fill="#1c1917" stroke="#d6d3d1" strokeWidth="1.5" />
            {/* Smoke stack */}
            <path d="M38 40V25H44V40" stroke="#a8a29e" strokeWidth="1.5" fill="#292524" />
          </svg>
          
          <div className="absolute bottom-2 right-3 text-[9px] font-mono text-stone-400/80 tracking-wider">{name || "Railroad Terminal"}</div>
        </div>
      )
    case "UTILITY":
      const isElectric = name.includes("Electric")
      return (
        <div className="w-full h-full relative flex items-center justify-center bg-gradient-to-br from-slate-900 to-indigo-950 p-2 overflow-hidden select-none">
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:10px_10px]" />
          
          {isElectric ? (
            <svg className="w-24 h-24 drop-shadow-[0_0_15px_rgba(165,180,252,0.45)]" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
              {/* Electric Bulb */}
              <path d="M35 45C35 25 65 25 65 45C65 55 58 62 55 68V76H45V68C42 62 35 55 35 45Z" fill="#1e1b4b" stroke="#818cf8" strokeWidth="3" />
              <rect x="46" y="76" width="8" height="6" fill="#4f46e5" stroke="#818cf8" strokeWidth="1.5" />
              {/* Filament */}
              <path d="M47 52L50 42L53 52" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : (
            <svg className="w-24 h-24 drop-shadow-[0_0_15px_rgba(96,165,250,0.45)]" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
              {/* Water Faucet / Drops */}
              <path d="M30 40H60C65 40 70 45 70 50V55H60V50H30V40Z" fill="#1e293b" stroke="#60a5fa" strokeWidth="2.5" />
              <rect x="25" y="32" width="10" height="16" fill="#3b82f6" />
              <path d="M45 55V65" stroke="#60a5fa" strokeWidth="3" strokeLinecap="round" />
              {/* Water droplet */}
              <path d="M45 72C42 72 40 74.5 40 77C40 79.5 42 82 45 82C48 82 50 79.5 50 77C50 74.5 48 72 45 72Z" fill="#93c5fd" />
            </svg>
          )}
          
          <div className="absolute bottom-2 right-3 text-[9px] font-mono text-indigo-400/80 tracking-wider">{name || "Public Utility"}</div>
        </div>
      )
    default:
      return null
  }
}
