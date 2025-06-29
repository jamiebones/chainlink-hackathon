'use client'
import React from 'react'
import { motion } from 'framer-motion'
import DashboardCard from '../components/DashboardCard'
import { useRouter } from 'next/navigation'

export default function LandingPage() {
  const router = useRouter()
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center relative bg-[#101014] overflow-hidden"
      style={{ letterSpacing: '-0.01em' }}
    >
      {/* Soft background gradients */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute -top-24 -left-32 w-[540px] h-[400px] bg-gradient-to-tr from-pink-400/25 via-blue-500/10 to-transparent rounded-full blur-3xl" />
        <div className="absolute top-2/3 right-1/4 w-[380px] h-[320px] bg-gradient-to-br from-purple-500/20 via-indigo-300/10 to-transparent rounded-full blur-2xl" />
        <div className="absolute top-1/4 left-2/3 w-[300px] h-[220px] bg-gradient-to-tl from-fuchsia-400/10 via-white/0 to-transparent rounded-full blur-2xl" />
        {/* (Optional) Add a soft dark noise texture here for extra depth */}
      </div>

      <div className="relative z-10 w-full max-w-6xl mx-auto px-4 py-14 flex flex-col items-center">
        <motion.h1
          className="text-5xl md:text-6xl font-bold text-white mb-3 tracking-tight"
          initial={{ opacity: 0, y: -35 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          style={{ fontFamily: 'Inter, Geist, sans-serif', letterSpacing: '-0.03em' }}
        >
          PsiX
        </motion.h1>
        <motion.div
          className="text-lg md:text-xl font-medium text-white/60 mb-12 text-center"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.25 }}
        >
          Private Perpetuals & Synthetic Assets on Chainlink. <br className="hidden md:inline" />
         
        </motion.div>
        <motion.div
          className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-9 w-full"
          initial="hidden"
          animate="visible"
          variants={{
            visible: { transition: { staggerChildren: 0.11 } },
            hidden: {},
          }}
        >
          {dashboardFeatures.map((feature, i) => (
            <motion.div
              key={feature.title}
              variants={{
                hidden: { opacity: 0, y: 30 },
                visible: { opacity: 1, y: 0 }
              }}
              whileHover={{ scale: 1.032, boxShadow: "0 12px 36px 0 rgba(30,26,100,0.13)" }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: "spring", stiffness: 330, damping: 32 }}
            >
              <DashboardCard
                {...feature}
                onClick={() => router.push(feature.link)}
              />
            </motion.div>
          ))}
        </motion.div>
      </div>
    </div>
  )
}

const dashboardFeatures = [
  {
    title: "Private Perpetuals",
    description:
      "Trade synthetic perps via encrypted batching. No wallet, size, or direction leaks—your alpha is safe.",
    icon: <span className="text-white text-2xl">🔒</span>,
    link: "/private",
  },
  {
    title: "zk-SNARK Liquidations",
    description:
      "Force liquidate using zk-proofs. Off-chain Merkle trees, on-chain integrity. No position exposure.",
    icon: <span className="text-white text-2xl">🧩</span>,
    link: "/liquidity",
  },
  {
    title: "Synthetic Minting (CCIP)",
    description:
      "Mint sTSLA and more with USDC. Permissionless, cross-chain, no KYC or custodians.",
    icon: <span className="text-white text-2xl">🌉</span>,
    link: "/mint",
  },
  {
    title: "Peg Stability Engine",
    description:
      "Dynamic fees, circuit breakers, and an on-chain buffer keep synths near oracle price.",
    icon: <span className="text-white text-2xl">⚖️</span>,
    link: "/peg",
  },
  {
    title: "Chainlink Stack",
    description:
      "Functions, Automation, CCIP & CCTP—secure oracles, circuit breakers, and cross-chain settlement.",
    icon: <span className="text-white text-2xl">🔗</span>,
    link: "/chainlink",
  },
  {
    title: "Protocol Revenue",
    description:
      "Transparent fees, buffer pool, and liquidation penalties drive protocol health and rewards.",
    icon: <span className="text-white text-2xl">💸</span>,
    link: "/revenue",
  }
]
