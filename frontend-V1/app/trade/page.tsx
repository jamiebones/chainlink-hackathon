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
    <div className="min-h-screen relative bg-gradient-to-br from-black via-slate-950/80 to-gray-950 overflow-hidden font-sans flex items-center justify-center">
      {/* Animated star field */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute -top-32 -left-40 w-[600px] h-[500px] bg-gradient-to-tr from-purple-500/30 via-blue-600/15 to-transparent rounded-full blur-3xl animate-pulse" />
        <div className="absolute top-2/3 right-1/4 w-[450px] h-[380px] bg-gradient-to-br from-pink-500/25 via-purple-400/10 to-transparent rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/4 left-2/3 w-[350px] h-[280px] bg-gradient-to-tl from-cyan-400/20 via-blue-300/5 to-transparent rounded-full blur-2xl animate-pulse" style={{ animationDelay: '2s' }} />
        <div className="absolute bottom-1/4 left-1/4 w-[300px] h-[250px] bg-gradient-to-tr from-emerald-400/15 via-teal-300/8 to-transparent rounded-full blur-2xl animate-pulse" style={{ animationDelay: '0.5s' }} />
      </div>
      <div className="relative z-10 w-full max-w-7xl mx-auto p-4 space-y-6">
        {/* Header */}
        <div className="glassy-card border-b border-white/10">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-purple-200 to-blue-200 tracking-tight">Trade</h1>
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2 text-sm text-slate-300">
                  <button className="w-full py-2 px-4 rounded-xl font-bold bg-gradient-to-r from-purple-500 via-pink-500 to-blue-500 text-white shadow-lg hover:from-pink-500 hover:to-purple-500 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-purple-400/40" onClick={handlePrivate}>Private Mode</button>
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                  <span className="text-white/80">Avalanche</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto p-4 space-y-6">
          <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
            <div className="xl:col-span-3">
              <MarketChart symbol={symbol === 'TSLA' ? 'TSLA' : 'AAPL'} />
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
