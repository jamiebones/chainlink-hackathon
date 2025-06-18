'use client'

import { useRouter } from 'next/navigation'
import React, { useEffect, useState } from 'react'
import { useReadContract } from 'wagmi'
import { formatUnits } from 'viem'
import abi from '@/abis/LiquidityPool.json'

const LIQ_POOL = '0x04825CDa198D4134f6Bb914f097b9ab141825bF4'

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
    <div className="max-w-4xl mx-auto px-4 py-12 text-white">
      <h1 className="text-3xl sm:text-4xl font-bold mb-3">🪙 Liquidity Pool</h1>
      <p className="text-slate-400 mb-10 text-sm sm:text-base">
        Manage your USDC liquidity. Choose an action below.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-10">
        <div
          onClick={() => router.push('/liquidity/deposit')}
          className="cursor-pointer bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-2xl p-6 shadow-lg transition"
        >
          <h2 className="text-lg font-semibold mb-2">📥 Deposit</h2>
          <p className="text-slate-400 text-sm">Add USDC to the pool and earn fees.</p>
        </div>

        <div
          onClick={() => router.push('/liquidity/withdraw')}
          className="cursor-pointer bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-2xl p-6 shadow-lg transition"
        >
          <h2 className="text-lg font-semibold mb-2">📤 Withdraw</h2>
          <p className="text-slate-400 text-sm">Redeem your LP tokens for USDC.</p>
        </div>

        <div
          onClick={() => router.push('/liquidity/claim')}
          className="cursor-pointer bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-2xl p-6 shadow-lg transition"
        >
          <h2 className="text-lg font-semibold mb-2">💰 Claim Fees</h2>
          <p className="text-slate-400 text-sm">Collect your share of trading fees.</p>
        </div>
      </div>

      {/* Pool Stats Section */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <StatCard title="💧 Total Liquidity" value={`$${liquidity}`} />
        <StatCard title="🔒 Reserved Liquidity" value={`$${reserved}`} />
        <StatCard title="📊 Utilization" value={`${utilization}%`} />
      </div>
    </div>
  )
}

function StatCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 shadow-lg">
      <h3 className="text-sm text-slate-400 mb-2">{title}</h3>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  )
}
