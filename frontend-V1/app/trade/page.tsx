// app/trade/page.tsx
'use client'

import React from 'react'
import MarketChart from '../components/MarketChart'
import TradeForm from '../components/TradeForm'
import PositionTable from '../components/PositionTable'

export default function TradePage() {
  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <div className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm">
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

      <div className="max-w-7xl mx-auto p-4 space-y-6">
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