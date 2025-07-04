'use client'

import { useRouter } from 'next/navigation'
import React, { useEffect, useState } from 'react'
import { useReadContract } from 'wagmi'
import { formatUnits } from 'viem'
import abi from '@/abis/LiquidityPool.json'

const LIQ_POOL = '0xD24FB6ebc087604af93D536B5A4562A0Dfa6Ab3a'

export default function LiquidityLanding() {
  const router = useRouter()
  const [liquidity, setLiquidity] = useState('0')
  const [reserved, setReserved] = useState('0')
  const [utilization, setUtilization] = useState('0')

  const { data: totalLiquidity } = useReadContract({
    address: LIQ_POOL,
    abi: abi.abi,
    functionName: 'totalLiquidity',
  })

  const { data: reservedLiquidity } = useReadContract({
    address: LIQ_POOL,
    abi: abi.abi,
    functionName: 'reservedLiquidity',
  })

  useEffect(() => {
    if (totalLiquidity && reservedLiquidity) {
      const tl = parseFloat(formatUnits(totalLiquidity, 6))
      const rl = parseFloat(formatUnits(reservedLiquidity, 6))
      const util = tl > 0 ? ((rl / tl) * 100).toFixed(2) : '0.00'
      setLiquidity(tl.toFixed(2))
      setReserved(rl.toFixed(2))
      setUtilization(util)
    }
  }, [totalLiquidity, reservedLiquidity])

  return (
    <div className="min-h-screen relative bg-black overflow-hidden font-sans flex flex-col items-center justify-center">
      {/* Cosmic animated background gradients (EXACT same as landing page) */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute -top-32 -left-40 w-[600px] h-[500px] bg-gradient-to-tr from-purple-500/40 via-blue-600/20 to-transparent rounded-full blur-3xl animate-pulse" />
        <div className="absolute top-2/3 right-1/4 w-[450px] h-[380px] bg-gradient-to-br from-pink-500/30 via-purple-400/15 to-transparent rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/4 left-2/3 w-[350px] h-[280px] bg-gradient-to-tl from-cyan-400/25 via-blue-300/10 to-transparent rounded-full blur-2xl animate-pulse" style={{ animationDelay: '2s' }} />
        <div className="absolute bottom-1/4 left-1/4 w-[300px] h-[250px] bg-gradient-to-tr from-emerald-400/20 via-teal-300/10 to-transparent rounded-full blur-2xl animate-pulse" style={{ animationDelay: '0.5s' }} />
      </div>
      <div className="relative z-10 w-full max-w-4xl mx-auto px-4 py-16">
        <div className="flex flex-col items-center mb-10">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse" />
            <span className="text-sm font-semibold text-slate-400 tracking-wider uppercase">Liquidity Pool</span>
            <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse" />
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-purple-200 to-blue-200 mb-2 tracking-tight text-center">USDC Liquidity Pool</h1>
          <p className="text-slate-400 text-base font-medium text-center max-w-2xl">Deposit, withdraw, and claim fees from perpetual trading activity. Your capital powers the protocol.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 mb-12">
          <GlassyCard
            label="📥 Deposit"
            desc="Add USDC to the pool and earn fees."
            onClick={() => router.push('/liquidity/deposit')}
          />
          <GlassyCard
            label="📤 Withdraw"
            desc="Redeem your LP tokens for USDC."
            onClick={() => router.push('/liquidity/withdraw')}
          />
          <GlassyCard
            label="💰 Claim Fees"
            desc="Collect your share of trading fees."
            onClick={() => router.push('/liquidity/claim')}
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
          <StatCard title="💧 Total Liquidity" value={`$${liquidity}`} />
          <StatCard title="🔒 Reserved Liquidity" value={`$${reserved}`} />
          <StatCard title="📊 Utilization" value={`${utilization}%`} />
        </div>
      </div>
    </div>
  )
}

function GlassyCard({
  label,
  desc,
  onClick,
}: {
  label: string
  desc: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="w-full h-full rounded-2xl border border-white/10 shadow-xl transition-all duration-200 px-6 py-8 flex flex-col items-start text-left cursor-pointer group backdrop-blur-xl bg-white/10 hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-purple-500/40"
      style={{ position: 'relative', overflow: 'hidden' }}
    >
      {/* Cosmic gradient overlay for button (matches landing page) */}
      <span className="absolute inset-0 z-0 rounded-2xl bg-gradient-to-r from-purple-500 via-pink-500 to-blue-500 opacity-60 group-hover:opacity-80 transition-all duration-200" />
      <span className="relative z-10 font-semibold text-lg text-white mb-2 group-hover:underline">{label}</span>
      <span className="relative z-10 text-slate-200 text-sm">{desc}</span>
    </button>
  )
}

function ActionButton({
  label,
  onClick,
}: {
  label: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="flex-1 px-6 py-3 rounded-xl bg-gradient-to-r from-purple-500 via-pink-500 to-blue-500 text-white text-lg font-bold shadow-md hover:scale-105 hover:shadow-xl transition-all duration-150 outline-none focus:ring-2 focus:ring-pink-400/40"
    >
      {label}
    </button>
  )
}

function StatCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="bg-white/10 border border-white/10 rounded-2xl p-6 shadow-lg backdrop-blur-xl text-center">
      <h3 className="text-sm text-slate-400 mb-2">{title}</h3>
      <p className="text-2xl font-bold text-white">{value}</p>
    </div>
  )
}
