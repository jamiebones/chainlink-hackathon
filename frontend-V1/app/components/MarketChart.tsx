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
    </div>
  )
}