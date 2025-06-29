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
    <div className="min-h-screen bg-[#111014] font-[Inter,sans-serif] flex flex-col items-center justify-center relative overflow-hidden">
      {/* Glassy Uniswap background gradients */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute -top-24 -left-32 w-[540px] h-[400px] bg-gradient-to-tr from-pink-400/20 via-blue-400/10 to-transparent rounded-full blur-3xl" />
        <div className="absolute top-2/3 right-1/4 w-[380px] h-[320px] bg-gradient-to-br from-purple-400/20 via-indigo-400/10 to-transparent rounded-full blur-2xl" />
        <div className="absolute top-1/4 left-2/3 w-[280px] h-[200px] bg-gradient-to-tl from-fuchsia-400/15 via-white/0 to-transparent rounded-full blur-2xl" />
      </div>
      <div className="relative z-10 w-full max-w-4xl mx-auto px-4 py-14 flex flex-col items-center">
        {/* Title and description */}
        <h1 className="text-3xl sm:text-4xl font-extrabold mb-3 text-white tracking-tight">🪙 Liquidity Pool</h1>
        <p className="text-slate-400 mb-10 text-center text-sm sm:text-base max-w-lg">
          Manage your USDC liquidity across deposit, withdraw, and fee claims.
        </p>
        
        {/* Main CTAs */}
        <div className="flex flex-col sm:flex-row gap-4 w-full max-w-2xl mb-8 justify-center">
          <ActionButton label="📥 Deposit" onClick={() => router.push('/liquidity/deposit')} />
          <ActionButton label="📤 Withdraw" onClick={() => router.push('/liquidity/withdraw')} />
          <ActionButton label="💰 Claim Fees" onClick={() => router.push('/liquidity/claim')} />
        </div>
        
        {/* Clickable cards for power users (optional, looks cool) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-10 w-full max-w-2xl">
          <GlassyCard
            label="📥 Deposit"
            desc="Add USDC to the pool and earn a share of trading fees."
            onClick={() => router.push('/liquidity/deposit')}
          />
          <GlassyCard
            label="📤 Withdraw"
            desc="Redeem your LP tokens for USDC, anytime."
            onClick={() => router.push('/liquidity/withdraw')}
          />
          <GlassyCard
            label="💰 Claim Fees"
            desc="Collect your accumulated trading fees."
            onClick={() => router.push('/liquidity/claim')}
          />
        </div>

        {/* Pool Stats Section */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 w-full max-w-2xl">
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
      className="w-full h-full rounded-2xl bg-white/10 hover:bg-white/15 border border-white/10 shadow-xl
      transition-all duration-200 px-6 py-8 flex flex-col items-start text-left cursor-pointer group backdrop-blur-xl"
    >
      <span className="font-semibold text-lg text-white mb-2 group-hover:underline">{label}</span>
      <span className="text-slate-400 text-sm">{desc}</span>
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
      className="flex-1 px-6 py-3 rounded-xl bg-gradient-to-r from-pink-400/80 to-blue-400/80
      text-white text-lg font-bold shadow-md hover:scale-105 hover:shadow-xl transition-all duration-150 outline-none focus:ring-2 focus:ring-pink-400/40"
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
