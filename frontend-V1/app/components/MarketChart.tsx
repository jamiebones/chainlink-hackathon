// app/trade/components/MarketChart.tsx
'use client'

import React, { useState } from 'react'

interface MarketChartProps {
  symbol: string
}

export default function MarketChart({ symbol }: MarketChartProps) {
  const [timeframe, setTimeframe] = useState('1H')
  
  const timeframes = ['5M', '15M', '1H', '4H', '1D', '1W']

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden">
      {/* Chart Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-700">
        <div className="flex items-center space-x-4">
          <h2 className="text-lg font-semibold text-white">
            {symbol}
          </h2>
          <div className="flex items-center space-x-2">
            <span className="text-2xl font-bold text-white">$185.25</span>
            <span className="text-green-400 text-sm">+2.34%</span>
          </div>
        </div>
        
        {/* Timeframe Selector */}
        <div className="flex items-center space-x-1 bg-slate-800 rounded-lg p-1">
          {timeframes.map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all duration-200 ${
                timeframe === tf
                  ? 'bg-blue-500 text-white'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700'
              }`}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      {/* Chart Container */}
      <div className="relative w-full h-96 bg-slate-950">
        <iframe
          src={`https://s.tradingview.com/widgetembed/?symbol=NASDAQ%3A${symbol.replace('s', '')}&interval=60&theme=dark&style=1&locale=en&toolbar_bg=%23f1f3f6&enable_publishing=false&allow_symbol_change=true&container_id=tradingview_chart`}
          className="w-full h-full border-0"
          title={`${symbol} Trading Chart`}
        />
        
        {/* Chart Loading Overlay */}
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950 opacity-0 pointer-events-none">
          <div className="flex items-center space-x-2 text-slate-400">
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <span>Loading chart...</span>
          </div>
        </div>
      </div>

      {/* Chart Footer with Market Stats */}
      <div className="p-4 border-t border-slate-700 bg-slate-800/50">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <div className="text-slate-400 mb-1">24h High</div>
            <div className="text-white font-medium">$189.45</div>
          </div>
          <div>
            <div className="text-slate-400 mb-1">24h Low</div>
            <div className="text-white font-medium">$182.10</div>
          </div>
          <div>
            <div className="text-slate-400 mb-1">24h Volume</div>
            <div className="text-white font-medium">$45.2M</div>
          </div>
          <div>
            <div className="text-slate-400 mb-1">Open Interest</div>
            <div className="text-white font-medium">$123.5M</div>
          </div>
        </div>
      </div>
    </div>
  )
}