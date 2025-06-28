'use client'
import DashboardCard from '../components/DashboardCard'
import { useRouter } from 'next/navigation'
import React from 'react'

export default function LandingPage() {
  const router = useRouter()
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#111112] relative overflow-hidden font-sans">
      {/* Blurred colored balls for Uniswap-style background */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <div className="absolute top-1/4 left-1/4 w-48 h-48 bg-pink-500 opacity-30 blur-3xl rounded-full" />
        <div className="absolute top-2/3 left-2/3 w-40 h-40 bg-yellow-400 opacity-20 blur-3xl rounded-full" />
        <div className="absolute top-1/2 left-1/2 w-32 h-32 bg-blue-400 opacity-20 blur-3xl rounded-full" />
        <div className="absolute top-1/3 left-2/3 w-36 h-36 bg-green-400 opacity-20 blur-3xl rounded-full" />
      </div>
      <div className="relative z-10 w-full max-w-7xl mx-auto px-4 py-12 min-h-[60vh]">
        <h2 className="text-4xl font-extrabold text-white mb-10 tracking-tight">Welcome to the sTSLA DeFi Dashboard</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          <DashboardCard
            title="Mint"
            description="Deposit USDC to mint sTSLA"
            icon={<span className="text-pink-400 text-lg">🪙</span>}
            onClick={() => router.push('/mint')}
          />
          <DashboardCard
            title="Trade"
            description="Open long/short positions on sTSLA"
            icon={<span className="text-yellow-300 text-lg">📈</span>}
            onClick={() => router.push('/trade')}
          />
          <DashboardCard
            title="Provide Liquidity"
            description="Stake to Perp Engine to earn fees"
            icon={<span className="text-green-300 text-lg">💧</span>}
            onClick={() => router.push('/liquidity')}
          />
          <DashboardCard
            title="Sweep Vault Slot"
            description="Withdraw buffer + PnL from closed positions"
            icon={<span className="text-blue-400 text-lg">💬</span>}
            onClick={() => router.push('/sweep')}
          />
        </div>
      </div>
    </div>
  )
}
