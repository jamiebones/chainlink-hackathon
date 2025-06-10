'use client'
import DashboardCard from '../components/DashboardCard'
import { useRouter } from 'next/navigation'
import React from 'react'

export default function LandingPage() {
  const router = useRouter()
  return (
    <div className="max-w-7xl mx-auto px-4 py-12 min-h-[60vh] font-[Inter,sans-serif] ">
      <h2 className="text-4xl font-extrabold text-white mb-10 tracking-tight">Welcome to the sTSLA DeFi Dashboard</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
        <DashboardCard
          title="Mint"
          description="Deposit USDC to mint sTSLA"
          icon={<span className="text-orange-400 text-lg">&#x2753;</span>}
          colorClass="bg-[rgba(255,98,0,0.08)] border-[rgba(255,98,0,0.18)] hover:bg-[rgba(255,98,0,0.16)] hover:border-[rgba(255,98,0,0.28)] shadow-[0_4px_32px_0_rgba(255,98,0,0.10)]"
          onClick={() => router.push('/mint')}
        />
        <DashboardCard
          title="Trade"
          description="Open long/short positions on sTSLA"
          icon={<span className="text-yellow-200 text-lg">📖</span>}
          colorClass="bg-[rgba(255,255,140,0.07)] border-[rgba(255,255,140,0.15)] hover:bg-[rgba(255,255,140,0.13)] hover:border-[rgba(255,255,140,0.25)] shadow-[0_4px_32px_0_rgba(255,255,140,0.08)]"
          onClick={() => router.push('/trade')}
        />
        <DashboardCard
          title="Provide Liquidity"
          description="Stake to Perp Engine to earn fees"
          icon={<span className="text-green-300 text-lg">💧</span>}
          colorClass="bg-[rgba(0,255,140,0.07)] border-[rgba(0,255,140,0.15)] hover:bg-[rgba(0,255,140,0.13)] hover:border-[rgba(0,255,140,0.25)] shadow-[0_4px_32px_0_rgba(0,255,140,0.08)]"
          onClick={() => router.push('/liquidity')}
        />
        <DashboardCard
          title="Sweep Vault Slot"
          description="Withdraw buffer + PnL from closed positions"
          icon={<span className="text-pink-400 text-lg">💬</span>}
          colorClass="bg-[rgba(255,0,140,0.08)] border-[rgba(255,0,140,0.18)] hover:bg-[rgba(255,0,140,0.16)] hover:border-[rgba(255,0,140,0.28)] shadow-[0_4px_32px_0_rgba(255,0,140,0.10)]"
          onClick={() => router.push('/sweep')}
        />
      </div>
    </div>
  )
}
