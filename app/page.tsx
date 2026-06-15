"use client"

import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import Image from "next/image"
import { Gamepad2, Users, MessageSquare, Zap, Trophy, Shield, Vote, Sparkles, ArrowRight } from "lucide-react"

const fadeIn = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
}

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.12 } },
}

const gameImages = [
  '/images/games/property-empire.png',
  '/images/games/naval-clash.jpg',
  '/images/games/hexland.jpg',
  '/images/games/color-clash.png',
  '/images/poker thumbnail.png',
  '/images/games/mystery-manor.png',
  '/images/games/quick-draw.png',
  '/images/games/doodle-dash.png',
  '/images/games/spymaster.png',
]

const features = [
  { icon: Users, color: "text-grape-300", glow: "group-hover:shadow-glow-grape", title: "Instant Parties", description: "Spin up a game room in seconds and pull friends in with a single share code." },
  { icon: Vote, color: "text-bubble-400", glow: "group-hover:shadow-glow-bubble", title: "Vote To Play", description: "Can't agree on a game? Everyone votes — the crowd favourite wins and launches for all." },
  { icon: Gamepad2, color: "text-aqua-400", glow: "group-hover:shadow-glow-aqua", title: "Real Board Games", description: "Fully playable Property Empire & Hexland right now, with more classics rolling in." },
  { icon: MessageSquare, color: "text-grape-300", glow: "group-hover:shadow-glow-grape", title: "Live Chat", description: "Talk smack, plan trades, and celebrate wins with realtime in-party chat." },
  { icon: Zap, color: "text-sunny-400", glow: "group-hover:shadow-glow-sunny", title: "Zero Installs", description: "No downloads, no setup. It runs in your browser and syncs everyone instantly." },
  { icon: Trophy, color: "text-bubble-400", glow: "group-hover:shadow-glow-bubble", title: "Game On", description: "Climb the leaderboard, track your wins, and earn bragging rights for the group chat." },
]

export default function Home() {
  const router = useRouter()
  const [currentImageIndex, setCurrentImageIndex] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % gameImages.length)
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  return (
    <main className="relative min-h-screen overflow-hidden">
      {/* Hero */}
      <section className="relative">
        <div className="container mx-auto px-4 pt-16 pb-20 lg:pt-24">
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
                Create a party, invite the crew, and <span className="text-white font-medium">vote on what to play</span>.
                PartyPlay brings everyone together for the board games you love — live, in your browser.
              </motion.p>

              <motion.div className="mt-9 flex flex-col sm:flex-row gap-4 justify-center lg:justify-start" variants={fadeIn}>
                <Button variant="brand" size="lg" className="gap-2" onClick={() => router.push("/auth/sign-up")}>
                  Start Playing Free
                  <ArrowRight className="h-5 w-5" />
                </Button>
                <Button variant="outline" size="lg" onClick={() => router.push("/games")}>
                  Browse Games
                </Button>
              </motion.div>

              <motion.div className="mt-8 flex items-center gap-6 justify-center lg:justify-start text-sm text-muted-foreground" variants={fadeIn}>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-mint-500 animate-pulse" />
                  Free to play
                </div>
                <div className="flex items-center gap-2">
                  <Gamepad2 className="h-4 w-4 text-aqua-400" />
                  11 games & counting
                </div>
              </motion.div>
            </motion.div>

            {/* Right — game showcase */}
            <motion.div
              className="flex-1 relative w-full"
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.2 }}
            >
              <div className="relative h-[380px] w-full max-w-[480px] mx-auto">
                <div className="absolute -inset-6 bg-brand opacity-20 blur-3xl rounded-full" />
                {gameImages.map((image, index) => (
                  <motion.div
                    key={image}
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
                      src={image}
                      alt="Game thumbnail"
                      fill
                      sizes="(max-width: 768px) 90vw, 480px"
                      style={{ objectFit: "cover" }}
                      priority={index === 0}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-background/70 via-transparent to-transparent" />
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
              Built for friends and families who'd rather play together than scroll apart.
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

      {/* CTA */}
      <motion.section
        className="relative py-24"
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
                Ready to roll the dice?
              </h2>
              <p className="text-lg text-white/80 mb-9 max-w-2xl mx-auto">
                Gather your people, pick a game, and let the good times begin. It's free — your next game night is one click away.
              </p>
              <Button variant="brand" size="lg" className="gap-2" onClick={() => router.push("/auth/sign-up")}>
                Create Your Free Account
                <ArrowRight className="h-5 w-5" />
              </Button>
            </div>
          </motion.div>
        </div>
      </motion.section>
    </main>
  )
}
