'use client'
import React, { useState, useEffect } from 'react'
import { ChevronRight, Shield, Zap, Coins, TrendingUp, Link, DollarSign, Mountain } from 'lucide-react'

// Animated stars component
function StarField() {
  const [stars, setStars] = useState([])
  
  useEffect(() => {
    const generateStars = () => {
      const newStars = []
      for (let i = 0; i < 150; i++) {
        newStars.push({
          id: i,
          x: Math.random() * 100,
          y: Math.random() * 100,
          size: Math.random() * 2 + 0.5,
          opacity: Math.random() * 0.8 + 0.2,
          animationDelay: Math.random() * 3
        })
      }
      setStars(newStars)
    }
    generateStars()
  }, [])

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {stars.map(star => (
        <div
          key={star.id}
          className="absolute bg-white rounded-full animate-pulse"
          style={{
            left: `${star.x}%`,
            top: `${star.y}%`,
            width: `${star.size}px`,
            height: `${star.size}px`,
            opacity: star.opacity,
            animationDelay: `${star.animationDelay}s`,
            animationDuration: '3s'
          }}
        />
      ))}
    </div>
  )
}

// Enhanced DashboardCard with cosmic effects
function DashboardCard({ title, description, icon: IconComponent, onClick, accent }) {
  const [isHovered, setIsHovered] = useState(false)
  
  return (
    <div 
      className="group relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Cosmic glow effect */}
      <div className={`absolute -inset-0.5 bg-gradient-to-r ${accent} rounded-3xl blur opacity-0 group-hover:opacity-75 transition duration-1000 group-hover:duration-200`} />
      
      <button
        onClick={onClick}
        className="relative w-full h-full p-8 rounded-3xl bg-slate-950/80 backdrop-blur-xl border border-slate-800/60 hover:border-slate-700/80 transition-all duration-300 outline-none focus:ring-2 focus:ring-purple-400/40 flex flex-col gap-5 items-start group overflow-hidden"
        style={{ minHeight: 240 }}
      >
        {/* Stardust particles effect */}
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
          {[...Array(12)].map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 bg-white rounded-full animate-ping"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${i * 0.1}s`,
                animationDuration: '2s'
              }}
            />
          ))}
        </div>
        
        {/* Main content */}
        <div className="flex items-center gap-4 mb-2 relative z-10">
          <div className={`p-3 rounded-2xl bg-gradient-to-br ${accent} shadow-lg group-hover:scale-110 transition-transform duration-300`}>
            <IconComponent className="w-6 h-6 text-white" />
          </div>
          <span className="font-bold text-white text-xl tracking-tight group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-purple-400 group-hover:to-pink-400 transition-all duration-300">
            {title}
          </span>
        </div>
        
        <div className="text-base font-medium text-slate-300 leading-relaxed relative z-10 flex-grow">
          {description}
        </div>
        
        {/* Arrow indicator */}
        <div className="flex items-center gap-2 mt-auto relative z-10">
          <span className="text-sm font-semibold text-purple-400 group-hover:text-purple-300 transition-colors">
            Explore
          </span>
          <ChevronRight className="w-4 h-4 text-purple-400 group-hover:text-purple-300 group-hover:translate-x-1 transition-all duration-300" />
        </div>
      </button>
    </div>
  )
}

export default function LandingPage() {
  const [currentTime, setCurrentTime] = useState(new Date())
  
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const dashboardFeatures = [
    {
      title: "Private Perpetuals",
      description: "Trade synthetic perps via encrypted batching. No wallet, size, or direction leaks—your alpha is safe.",
      icon: Shield,
      accent: "from-purple-600 to-blue-600",
    },
    {
      title: "zk-SNARK Liquidations",
      description: "Force liquidate using zk-proofs. Off-chain Merkle trees, on-chain integrity. No position exposure.",
      icon: Zap,
      accent: "from-cyan-500 to-blue-500",
    },
    {
      title: "Synthetic Minting (CCIP)",
      description: "Mint sTSLA and more with USDC. Permissionless, cross-chain, no KYC or custodians.",
      icon: Coins,
      accent: "from-emerald-500 to-teal-500",
    },
    {
      title: "Peg Stability Engine",
      description: "Dynamic fees, circuit breakers, and an on-chain buffer keep synths near oracle price.",
      icon: TrendingUp,
      accent: "from-orange-500 to-red-500",
    },
    {
      title: "Chainlink Stack",
      description: "Functions, Automation, CCIP & CCTP—secure oracles, circuit breakers, and cross-chain settlement.",
      icon: Link,
      accent: "from-pink-500 to-purple-500",
    },
    {
      title: "Protocol Revenue",
      description: "Transparent fees, buffer pool, and liquidation penalties drive protocol health and rewards.",
      icon: DollarSign,
      accent: "from-yellow-500 to-orange-500",
    }
  ]

  return (
    <div className="min-h-screen relative bg-gradient-to-br from-black via-slate-950/80 to-gray-950 overflow-hidden">
      {/* Animated star field */}
      <StarField />
      
      {/* Enhanced cosmic background gradients */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute -top-32 -left-40 w-[600px] h-[500px] bg-gradient-to-tr from-purple-500/30 via-blue-600/15 to-transparent rounded-full blur-3xl animate-pulse" />
        <div className="absolute top-2/3 right-1/4 w-[450px] h-[380px] bg-gradient-to-br from-pink-500/25 via-purple-400/10 to-transparent rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/4 left-2/3 w-[350px] h-[280px] bg-gradient-to-tl from-cyan-400/20 via-blue-300/5 to-transparent rounded-full blur-2xl animate-pulse" style={{ animationDelay: '2s' }} />
        <div className="absolute bottom-1/4 left-1/4 w-[300px] h-[250px] bg-gradient-to-tr from-emerald-400/15 via-teal-300/8 to-transparent rounded-full blur-2xl animate-pulse" style={{ animationDelay: '0.5s' }} />
        
        {/* Orbital rings */}
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] border border-purple-500/10 rounded-full animate-spin" style={{ animationDuration: '60s' }} />
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[1000px] border border-blue-500/5 rounded-full animate-spin" style={{ animationDuration: '80s', animationDirection: 'reverse' }} />
      </div>

      <div className="relative z-10 w-full max-w-7xl mx-auto px-6 py-16 flex flex-col items-center">
        {/* Header section */}
        <div className="flex items-center gap-3 mb-4 opacity-80">
          <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse" />
          <span className="text-sm font-semibold text-slate-400 tracking-wider uppercase">
            DeFi Protocol
          </span>
          <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse" />
        </div>

        <div className="text-center mb-16">
          <h1 className="text-6xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-purple-200 to-blue-200 mb-6 tracking-tight leading-tight">
            psiX
          </h1>
          <div className="text-sm font-medium text-purple-400/80 mb-3 tracking-widest uppercase">
            Advanced DeFi Protocol
          </div>
          <div className="text-xl md:text-2xl font-medium text-slate-300 leading-relaxed max-w-4xl mx-auto">
            Private Perpetuals & Synthetic Assets on Avalanche
            <br />
            
          </div>
        </div>

        {/* Status indicator */}
        <div className="flex items-center gap-4 mb-12 p-4 rounded-2xl bg-black/60 backdrop-blur-sm border border-slate-800/40">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse" />
            <span className="text-sm font-semibold text-green-400">Protocol Active</span>
          </div>
          <div className="w-px h-4 bg-slate-600" />
          <span className="text-xs text-slate-400 font-mono">
            {currentTime.toLocaleTimeString()}
          </span>
        </div>

        {/* Enhanced grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8 w-full">
          {dashboardFeatures.map((feature, i) => (
            <div
              key={feature.title}
              className="opacity-0 animate-fade-in-up"
              style={{ 
                animationDelay: `${i * 0.15}s`,
                animationFillMode: 'forwards'
              }}
            >
              <DashboardCard
                {...feature}
                onClick={() => console.log(`Navigate to ${feature.title}`)}
              />
            </div>
          ))}
        </div>

        {/* Footer cosmic signature */}
        <div className="mt-20 text-center">
          <div className="text-xs text-slate-500 font-mono tracking-wider">
            ✨ Advanced DeFi Infrastructure • Built for Professional Traders ✨
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes fade-in-up {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in-up {
          animation: fade-in-up 0.6s ease-out;
        }
      `}</style>
    </div>
  )
}