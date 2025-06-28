'use client'
import React, { useState } from 'react'
import MarketChart from '../components/MarketChart'
import TradeForm from '../components/TradeForm'
import PositionTable from '../components/PositionTable'
import { useRouter } from 'next/navigation'

export default function TradePage() {
  const [symbol, setSymbol] = useState<'TSLA' | 'APPL'>('TSLA')
  const router = useRouter()
  const handlePrivate = () => {
    router.push('/private')
  }
  return (
    <div className="min-h-screen flex items-center justify-center relative bg-[#111014] font-[Inter,sans-serif] overflow-hidden">
      {/* Soft glassy background gradients */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute -top-24 -left-32 w-[540px] h-[400px] bg-gradient-to-tr from-pink-400/20 via-blue-400/10 to-transparent rounded-full blur-3xl" />
        <div className="absolute top-2/3 right-1/4 w-[380px] h-[320px] bg-gradient-to-br from-purple-400/20 via-indigo-400/10 to-transparent rounded-full blur-2xl" />
        <div className="absolute top-1/4 left-2/3 w-[280px] h-[200px] bg-gradient-to-tl from-fuchsia-400/15 via-white/0 to-transparent rounded-full blur-2xl" />
      </div>
      <div className="relative z-10 w-full max-w-7xl mx-auto p-4 space-y-8">
        {/* Header */}
        <div className="backdrop-blur-xl rounded-2xl bg-white/5 border border-white/10 shadow-md">
          <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
            <h1 className="text-2xl font-bold text-white tracking-tight">Trade</h1>
            <div className="flex items-center gap-4">
              <button
                className="px-4 py-2 bg-slate-900/70 hover:bg-slate-800/90 border border-white/10 text-white/90 rounded-lg font-semibold transition-all duration-150"
                onClick={handlePrivate}
              >
                Private Mode
              </button>
              <div className="flex items-center gap-2 text-sm text-slate-300">
                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                <span className="text-white/80">Avalanche</span>
              </div>
            </div>
          </div>
        </div>
        {/* Main Content */}
        <div className="max-w-7xl mx-auto p-2 space-y-6">
          <div className="grid grid-cols-1 xl:grid-cols-4 gap-7">
            <div className="xl:col-span-3">
              <MarketChart symbol={symbol} />
            </div>
            <div className="xl:col-span-1">
              <TradeForm symbol={symbol} setSymbol={setSymbol} />
            </div>
          </div>
          <PositionTable />
        </div>
      </div>
    </div>
  )
}
