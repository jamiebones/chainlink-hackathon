'use client'

import { useWriteContract, useAccount } from 'wagmi'
import { useState } from 'react'
import abi from '@/abis/LiquidityPool.json'

const LIQ_POOL = '0x04825CDa198D4134f6Bb914f097b9ab141825bF4'
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
    <div className="min-h-screen flex items-center justify-center bg-[#111014] font-[Inter,sans-serif] relative overflow-hidden">
      {/* Glassy Uniswap background */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute -top-24 -left-32 w-[540px] h-[400px] bg-gradient-to-tr from-pink-400/20 via-blue-400/10 to-transparent rounded-full blur-3xl" />
        <div className="absolute top-2/3 right-1/4 w-[380px] h-[320px] bg-gradient-to-br from-purple-400/20 via-indigo-400/10 to-transparent rounded-full blur-2xl" />
        <div className="absolute top-1/4 left-2/3 w-[280px] h-[200px] bg-gradient-to-tl from-fuchsia-400/15 via-white/0 to-transparent rounded-full blur-2xl" />
      </div>
      <div className="relative z-10 w-full max-w-md mx-auto p-8 flex flex-col items-center">
        <div className="w-full bg-white/10 border border-white/10 rounded-2xl shadow-2xl backdrop-blur-xl p-8 flex flex-col gap-7 items-center">
          <h1 className="text-3xl font-extrabold mb-3 text-white text-center tracking-tight">
            💰 Claim Rewards
          </h1>
          <p className="text-slate-400 text-sm mb-3 text-center">
            Collect your share of trading fees accumulated from protocol activity.
          </p>

          <div className="w-full flex items-center justify-between mb-3">
            <span className="text-slate-300 text-sm">Claimable Rewards</span>
            <span className="font-semibold text-white">Auto-calculated</span>
          </div>

          <button
            onClick={handleClaim}
            disabled={loading}
            className={`w-full py-3 rounded-xl font-bold text-lg transition-all shadow-md
              ${loading
                ? 'bg-slate-600 text-slate-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-yellow-400 to-pink-400 text-black hover:scale-105 hover:shadow-xl'}
            `}
          >
            {loading ? (
              <span className="flex items-center justify-center">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></span>
                Processing...
              </span>
            ) : 'Claim Fees'}
          </button>
        </div>
      </div>
    </div>
  )
}
