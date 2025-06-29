'use client'

import { useWriteContract, useAccount } from 'wagmi'
import { useState } from 'react'
import { parseUnits } from 'viem'
import poolAbiJson from '@/abis/LiquidityPool.json'
import usdcAbiJson from '@/abis/MockERc20.json'

const LIQ_POOL = '0xD24FB6ebc087604af93D536B5A4562A0Dfa6Ab3a'
const USDC_TOKEN = '0x5425890298aed601595a70AB815c96711a31Bc65'

const POOL_ABI = poolAbiJson.abi
const USDC_ABI = usdcAbiJson.abi

export default function WithdrawPage() {
  const { writeContractAsync } = useWriteContract()
  const { isConnected } = useAccount()

  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(false)

  const handleWithdraw = async () => {
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
      // Approve LP token burn (if required by your contract logic)
      await writeContractAsync({
        address: USDC_TOKEN,
        abi: USDC_ABI,
        functionName: 'approve',
        args: [LIQ_POOL, usdcAmount],
      })
      await writeContractAsync({
        address: LIQ_POOL,
        abi: POOL_ABI,
        functionName: 'withdraw',
        args: [usdcAmount],
      })
      alert('✅ Withdrawal successful!')
      setAmount('')
    } catch (err) {
      console.error(err)
      alert('❌ Withdrawal failed. Check logs.')
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
          <h1 className="text-2xl font-extrabold mb-2 text-white tracking-tight">
            Withdraw from Pool
          </h1>
          <p className="text-slate-400 mb-5 text-sm text-center">
            Withdraw your USDC by burning your LP tokens.
          </p>
          <div className="w-full">
            <label className="block text-sm font-medium mb-2 text-slate-300">USDC Amount</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-4 py-3 bg-black/20 border border-white/15 rounded-lg text-white text-base focus:outline-none focus:ring-2 focus:ring-pink-400"
              placeholder="Enter amount"
              min="0"
              step="0.01"
              disabled={loading}
            />
          </div>
          <button
            onClick={handleWithdraw}
            disabled={loading || !amount || parseFloat(amount) <= 0}
            className={`w-full py-3 rounded-xl font-bold text-lg transition-all shadow-md
              ${loading || !amount || parseFloat(amount) <= 0
                ? 'bg-slate-600 text-slate-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-pink-400 to-yellow-400 text-black hover:scale-105 hover:shadow-xl'}
            `}
          >
            {loading ? (
              <span className="flex items-center justify-center">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></span>
                Processing...
              </span>
            ) : 'Withdraw USDC'}
          </button>
        </div>
      </div>
    </div>
  )
}
