'use client'

import React, { useState } from 'react'

export default function MintPage() {
  const [shares, setShares] = useState('')
  const [assetType, setAssetType] = useState('sTSLA')
  const [loading, setLoading] = useState(false)

  // Dummy handler for now
  const handleOpenPosition = async () => {
    setLoading(true)
    // Here you would call your smart contract function with ethers.js/wagmi
    // For now, just log the values
    console.log('Open Position:', { assetType, shares })
    setTimeout(() => setLoading(false), 1200)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#111112] relative overflow-hidden">
      {/* Blurred colored balls for Uniswap-style background */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <div className="absolute top-1/4 left-1/4 w-48 h-48 bg-pink-500 opacity-30 blur-3xl rounded-full" />
        <div className="absolute top-2/3 left-2/3 w-40 h-40 bg-yellow-400 opacity-20 blur-3xl rounded-full" />
        <div className="absolute top-1/2 left-1/2 w-32 h-32 bg-blue-400 opacity-20 blur-3xl rounded-full" />
        <div className="absolute top-1/3 left-2/3 w-36 h-36 bg-green-400 opacity-20 blur-3xl rounded-full" />
      </div>
      <div className="relative z-10 w-full max-w-md mx-auto rounded-3xl bg-[#18181b]/90 border border-white/10 shadow-2xl p-8 flex flex-col gap-6 backdrop-blur-md">
        <h2 className="text-2xl font-bold text-white mb-2 text-center">Open Position</h2>
        <div className="flex flex-col gap-4">
          <label className="text-white/80 font-medium">Asset</label>
          <select
            className="bg-[#232329] border border-white/10 rounded-xl px-4 py-3 text-lg text-white focus:outline-none"
            value={assetType}
            onChange={e => setAssetType(e.target.value)}
          >
            <option value="sTSLA">sTSLA</option>
            <option value="sAAPL">sAAPL</option>
            
            {/* Add more assets as needed */}
          </select>
        </div>
        <div className="flex flex-col gap-4">
          <label className="text-white/80 font-medium">Number of Shares</label>
          <input
            type="number"
            min="0"
            step="any"
            className="bg-[#232329] border border-white/10 rounded-xl px-4 py-3 text-lg text-white focus:outline-none"
            placeholder="Enter amount"
            value={shares}
            onChange={e => setShares(e.target.value)}
          />
        </div>
        <button
          className="mt-4 bg-pink-500 hover:bg-pink-400 transition-all text-white font-bold text-lg py-3 rounded-2xl shadow-lg focus:outline-none focus:ring-2 focus:ring-pink-400/40"
          onClick={handleOpenPosition}
          disabled={loading || !shares}
        >
          {loading ? 'Opening...' : 'Open Position'}
        </button>
      </div>
    </div>
  )
}