'use client'

import { useWriteContract, useAccount } from 'wagmi'
import { useState } from 'react'
import { parseUnits } from 'viem'
import poolAbiJson from '@/abis/LiquidityPool.json'
import usdcAbiJson from '@/abis/MockERc20.json'

const LIQ_POOL = '0x04825CDa198D4134f6Bb914f097b9ab141825bF4'
const USDC_TOKEN = '0xae68c3d71bb66c75492Af7626c0eAAF918Ec4630'

const POOL_ABI = poolAbiJson.abi
const USDC_ABI = usdcAbiJson.abi

export default function DepositPage() {
  const { writeContractAsync } = useWriteContract()
  const { isConnected } = useAccount()

  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(false)

  const handleDeposit = async () => {
    if (!isConnected) {
      alert('⚠️ Please connect your wallet.')
      return
    }

    if (!amount || parseFloat(amount) <= 0) {
      alert('⚠️ Enter a valid amount.')
      return
    }

    const usdcAmount = parseUnits(amount, 6)

    try {
      setLoading(true)

      await writeContractAsync({
        address: USDC_TOKEN,
        abi: USDC_ABI,
        functionName: 'approve',
        args: [LIQ_POOL, usdcAmount],
      })

      await writeContractAsync({
        address: LIQ_POOL,
        abi: POOL_ABI,
        functionName: 'deposit',
        args: [usdcAmount],
      })

      alert('✅ Deposit successful!')
      setAmount('')
    } catch (err) {
      console.error(err)
      alert('❌ Deposit failed. Please check logs.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto py-12 px-6 text-white">
      <h1 className="text-3xl font-bold mb-2">Deposit to Liquidity Pool</h1>
      <p className="text-slate-400 mb-8 text-sm">
        Provide USDC to earn fees from perpetual traders.
      </p>

      <div className="bg-slate-800 rounded-xl p-6 shadow-md border border-slate-700 space-y-6">
        <div>
          <label className="block text-sm font-medium mb-1 text-slate-300">USDC Amount</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full px-4 py-2 bg-slate-900 text-white border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            placeholder="Enter amount"
            min="0"
            step="0.01"
          />
        </div>

        <button
          onClick={handleDeposit}
          disabled={loading || !amount || parseFloat(amount) <= 0}
          className={`w-full py-3 rounded-lg font-semibold text-sm transition-all duration-200 ${
            loading || !amount || parseFloat(amount) <= 0
              ? 'bg-slate-600 text-slate-400 cursor-not-allowed'
              : 'bg-green-500 hover:bg-green-600 text-white'
          }`}
        >
          {loading ? 'Processing...' : 'Deposit USDC'}
        </button>
      </div>
    </div>
  )
}
