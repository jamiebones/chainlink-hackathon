// app/trade/page.tsx
'use client'

import React from 'react'
import MarketChart from '../components/MarketChart'
import TradeForm from '../components/TradeForm'
import PositionTable from '../components/PositionTable'

export default function TradePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#111112] relative overflow-hidden">
      {/* Blurred colored balls for Uniswap-style background */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <div className="absolute top-1/4 left-1/4 w-48 h-48 bg-pink-500 opacity-30 blur-3xl rounded-full" />
        <div className="absolute top-2/3 left-2/3 w-40 h-40 bg-yellow-400 opacity-20 blur-3xl rounded-full" />
        <div className="absolute top-1/2 left-1/2 w-32 h-32 bg-blue-400 opacity-20 blur-3xl rounded-full" />
        <div className="absolute top-1/3 left-2/3 w-36 h-36 bg-green-400 opacity-20 blur-3xl rounded-full" />
      </div>
      <div className="relative z-10 w-full max-w-7xl mx-auto p-4 space-y-6">
        {/* Header */}
        <div className="border-b border-white/10 bg-[#18181b]/80 backdrop-blur-md rounded-2xl shadow-lg">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold text-white">Trade</h1>
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2 text-sm text-slate-300">
                  <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                  <span>Arbitrum</span>
                </div>
                <div className="px-3 py-1 bg-slate-800 rounded-lg text-sm text-slate-300">
                  TSLA: $185.25
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Trading Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
          {/* Chart Section */}
          <div className="xl:col-span-3">
            <MarketChart symbol="sTSLA" />
          </div>
          
          {/* Trade Form */}
          <div className="xl:col-span-1">
            <TradeForm />
          </div>
        </div>
        
        {/* Positions Table */}
        <PositionTable />
      </div>
    </div>
  )
}