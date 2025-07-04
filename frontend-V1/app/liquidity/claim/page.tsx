'use client'

import { useWriteContract, useAccount } from 'wagmi'
import { useState } from 'react'
import abi from '@/abis/LiquidityPool.json'

const LIQ_POOL = '0xD24FB6ebc087604af93D536B5A4562A0Dfa6Ab3a'
const ABI = abi.abi

export default function ClaimPage() {
  const { writeContractAsync } = useWriteContract()
  const { isConnected } = useAccount()

  const [loading, setLoading] = useState(false)

  const handleClaim = async () => {
    if (!isConnected) {
      alert('⚠️ Please connect your wallet.')
      return
    }
    try {
      setLoading(true)
      await writeContractAsync({
        address: LIQ_POOL,
        abi: ABI,
        functionName: 'claimFees',
        args: [],
      })
      alert('✅ Fees claimed successfully!')
    } catch (err) {
      console.error(err)
      alert('❌ Claim failed. Please check your wallet or contract.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen relative bg-gradient-to-br from-black via-slate-950/80 to-gray-950 overflow-hidden font-sans flex items-center justify-center">
      {/* Animated star field */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute -top-32 -left-40 w-[600px] h-[500px] bg-gradient-to-tr from-purple-500/30 via-blue-600/15 to-transparent rounded-full blur-3xl animate-pulse" />
        <div className="absolute top-2/3 right-1/4 w-[450px] h-[380px] bg-gradient-to-br from-pink-500/25 via-purple-400/10 to-transparent rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/4 left-2/3 w-[350px] h-[280px] bg-gradient-to-tl from-cyan-400/20 via-blue-300/5 to-transparent rounded-full blur-2xl animate-pulse" style={{ animationDelay: '2s' }} />
        <div className="absolute bottom-1/4 left-1/4 w-[300px] h-[250px] bg-gradient-to-tr from-emerald-400/15 via-teal-300/8 to-transparent rounded-full blur-2xl animate-pulse" style={{ animationDelay: '0.5s' }} />
      </div>
      <div className="relative z-10 w-full max-w-md mx-auto glassy-card p-8 border border-slate-800/60 shadow-2xl backdrop-blur-xl">
        <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-purple-200 to-blue-200 mb-2 text-center tracking-tight">💰 Claim Rewards</h1>
        <p className="text-slate-400 mb-8 text-base font-medium text-center">
          Collect your share of trading fees accumulated from protocol activity.
        </p>
        <div className="bg-slate-900/80 border border-slate-700 rounded-xl shadow-lg p-6 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-slate-300 text-sm">Claimable Rewards</span>
            <span className="font-semibold text-white">Auto-calculated</span>
          </div>
          <button
            onClick={handleClaim}
            disabled={loading}
            className={`w-full py-3 rounded-xl font-bold text-lg bg-gradient-to-r from-purple-500 via-pink-500 to-blue-500 text-white shadow-lg hover:from-pink-500 hover:to-purple-500 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-purple-400/40 ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {loading ? 'Processing...' : 'Claim Fees'}
          </button>
        </div>
      </div>
    </div>
  )
}
