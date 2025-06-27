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
    <div className="max-w-md mx-auto py-12 px-6 text-white">
      <h1 className="text-2xl font-bold mb-4">💰 Claim Rewards</h1>
      <p className="text-slate-400 text-sm mb-6">
        Collect your share of trading fees accumulated from protocol activity.
      </p>

      <div className="bg-slate-800 border border-slate-700 rounded-xl shadow-lg p-6 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-slate-300 text-sm">Claimable Rewards</span>
          <span className="font-semibold text-white">Auto-calculated</span>
        </div>

        <button
          onClick={handleClaim}
          disabled={loading}
          className={`w-full py-3 rounded-lg font-semibold transition ${
            loading
              ? 'bg-slate-600 text-slate-400 cursor-not-allowed'
              : 'bg-yellow-400 hover:bg-yellow-500 text-black'
          }`}
        >
          {loading ? 'Processing...' : 'Claim Fees'}
        </button>
      </div>
    </div>
  )
}
