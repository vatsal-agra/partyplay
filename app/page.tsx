"use client"

import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import Image from "next/image"
import { Gamepad2, Users, MessageSquare, Zap, Trophy, Shield } from "lucide-react"

// Animation variants
const fadeIn = {
  hidden: { opacity: 0, y: 20 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.6 }
  }
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.2
    }
  }
};

const gameImages = [
  '/images/monopoly thumbnail.png',
  '/images/Battleship thumbnail.png',
  '/images/catan thumbnail.png',
  '/images/uno final thumbnail.png',
  '/images/poker thumbnail.png',
  '/images/cluedo thumbnail.png',
  '/images/pictionary thumbnail.png',
  '/images/scribbleio thumbnail.png',
  '/images/codenames thumbnal.png',
  '/images/terra mystica thumbnail.png',
  '/images/7wonders thumbnail.png',
];

export default function Home() {
  const router = useRouter();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  
  // Rotate through game images
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % gameImages.length);
    }, 3000);
    
    return () => clearInterval(interval);
  }, []);

  return (
    <main className="min-h-screen overflow-hidden bg-gradient-to-br from-cyan-500 via-purple-500 to-pink-500">
      {/* Background with animated gradient */}
      <div className="fixed inset-0 bg-gradient-to-br from-cyan-500 via-purple-500 to-pink-500 animate-gradient-x -z-10">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute w-full h-full bg-[url('/images/grid-pattern.svg')] bg-repeat bg-center"></div>
        </div>
      </div>
      
      {/* Hero Section */}
      <div className="relative">
        <div className="container mx-auto px-4 pt-20 pb-16">
          <motion.div 
            className="flex flex-col md:flex-row items-center justify-between gap-12"
            initial="hidden"
            animate="visible"
            variants={staggerContainer}
          >
            {/* Left side content */}
            <motion.div 
              className="flex-1 text-center md:text-left"
              variants={fadeIn}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="mb-6 inline-block"
              >
                <h1 className="text-6xl md:text-7xl font-bold mb-4 relative inline-block">
                  <span className="relative z-10 text-white">PartyPlay</span>
                  <span className="absolute inset-0 text-transparent bg-clip-text [text-shadow:0_0_1px_#fff,0_0_2px_#fff,0_0_3px_#fff]">PartyPlay</span>
                </h1>
              </motion.div>
              
              <motion.p 
                className="text-xl text-white/90 mb-8 max-w-xl"
                variants={fadeIn}
              >
                Create gaming parties, invite friends, and play your favorite games together. 
                The ultimate platform for social gaming experiences.
              </motion.p>
              
              <motion.div 
                className="flex flex-col sm:flex-row gap-4 justify-center md:justify-start"
                variants={fadeIn}
              >
                <Button
                  onClick={() => router.push("/auth/sign-up")}
                  className="bg-gradient-to-r from-cyan-500 to-pink-500 hover:from-cyan-600 hover:to-pink-600 text-white px-8 py-6 rounded-lg shadow-lg text-lg font-medium transition-all duration-300 hover:shadow-cyan-500/30"
                >
                  Get Started
                </Button>
                <Button
                  onClick={() => router.push("/auth/sign-in")}
                  className="bg-gradient-to-r from-cyan-500 to-pink-500 hover:from-cyan-600 hover:to-pink-600 text-white px-8 py-6 rounded-lg shadow-lg text-lg font-medium transition-all duration-300 hover:shadow-cyan-500/30"
                >
                  Sign In
                </Button>
              </motion.div>
            </motion.div>
            
            {/* Right side game showcase */}
            <motion.div 
              className="flex-1 relative"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.3 }}
            >
              <div className="relative h-[400px] w-full max-w-[500px] mx-auto">
                {gameImages.map((image, index) => (
                  <motion.div
                    key={image}
                    className="absolute inset-0 rounded-2xl overflow-hidden shadow-2xl"
                    initial={{ opacity: 0, rotateY: -20, scale: 0.9 }}
                    animate={{
                      opacity: index === currentImageIndex ? 1 : 0,
                      rotateY: index === currentImageIndex ? 0 : -20,
                      scale: index === currentImageIndex ? 1 : 0.9,
                      zIndex: index === currentImageIndex ? 10 : 0
                    }}
                    transition={{ duration: 0.7, ease: "easeInOut" }}
                  >
                    <Image
                      src={image}
                      alt="Game thumbnail"
                      fill
                      style={{ objectFit: 'cover' }}
                      priority={index === 0}
                      onError={(e) => {
                        console.error(`Error loading image: ${image}`);
                        const target = e.target as HTMLImageElement;
                        target.onerror = null; // Prevent infinite loop
                        target.src = `https://via.placeholder.com/500x400/1f2937/ffffff?text=${encodeURIComponent('Game Thumbnail')}`;
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                  </motion.div>
                ))}
                
                {/* Floating game controller */}
                <motion.div
                  className="absolute -bottom-10 -right-10 z-20 bg-gradient-to-br from-cyan-500 to-pink-500 p-5 rounded-full shadow-lg"
                  animate={{
                    y: [0, -10, 0],
                    rotate: [0, 5, 0, -5, 0],
                  }}
                  transition={{
                    duration: 5,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                >
                  <Gamepad2 className="h-10 w-10 text-white" />
                </motion.div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>
      
      {/* Features Section */}
      <motion.div 
        className="relative bg-black/20 backdrop-blur-sm py-20 z-10"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.2 }}
        variants={staggerContainer}
      >
        <div className="container mx-auto px-4">
          <motion.h2 
            className="text-4xl font-bold text-center text-white mb-16"
            variants={fadeIn}
          >
            Why Choose PartyPlay?
          </motion.h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            {[
              {
                icon: <Users className="h-10 w-10 text-cyan-300" />,
                title: "Easy Party Creation",
                description: "Create a gaming party in seconds and invite friends with a unique code."
              },
              {
                icon: <Gamepad2 className="h-10 w-10 text-pink-300" />,
                title: "Diverse Game Library",
                description: "Choose from a wide selection of popular board and card games to play together."
              },
              {
                icon: <MessageSquare className="h-10 w-10 text-purple-300" />,
                title: "Real-time Interaction",
                description: "Chat with party members while playing and make new friends."
              },
              {
                icon: <Zap className="h-10 w-10 text-yellow-300" />,
                title: "Instant Play",
                description: "No downloads required. Start playing immediately in your browser."
              },
              {
                icon: <Trophy className="h-10 w-10 text-green-300" />,
                title: "Competitive Play",
                description: "Track scores and compete with friends in various game modes."
              },
              {
                icon: <Shield className="h-10 w-10 text-orange-300" />,
                title: "Secure & Private",
                description: "Create private parties that only invited members can join."
              }
            ].map((feature, index) => (
              <motion.div 
                key={index}
                className="bg-white/5 backdrop-blur-sm border border-white/10 hover:border-cyan-500/30 p-6 rounded-xl shadow-lg transition-all duration-300 hover:shadow-cyan-500/10 hover:-translate-y-1"
                variants={fadeIn}
              >
                <div className="bg-gradient-to-br from-cyan-500/20 to-pink-500/20 p-3 rounded-lg inline-block mb-4">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-bold text-white mb-3">{feature.title}</h3>
                <p className="text-white/80">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>
      
      {/* CTA Section */}
      <motion.div 
        className="relative py-20 z-10"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        variants={staggerContainer}
      >
        <div className="container mx-auto px-4 text-center">
          <motion.h2 
            className="text-4xl font-bold text-white mb-6"
            variants={fadeIn}
          >
            Ready to Start Playing?
          </motion.h2>
          <motion.p 
            className="text-xl text-white/80 mb-10 max-w-2xl mx-auto"
            variants={fadeIn}
          >
            Join thousands of players already using PartyPlay to connect and play games together.
          </motion.p>
          <motion.div variants={fadeIn}>
            <Button
              onClick={() => router.push("/auth/sign-up")}
              className="bg-gradient-to-r from-cyan-500 to-pink-500 hover:from-cyan-600 hover:to-pink-600 text-white px-10 py-6 rounded-lg shadow-lg text-lg font-medium transition-all duration-300 hover:shadow-cyan-500/30"
            >
              Create Your Account
            </Button>
          </motion.div>
        </div>
      </motion.div>
    </main>
  )
}
