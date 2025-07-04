'use client'
import React, { useState } from 'react'

interface MarketChartProps {
  symbol: string
}

export default function MarketChart({ symbol }: MarketChartProps) {
  // Add soft toggle if you want, here kept simple.
  return (
    <div className="bg-[#18181b]/80 border border-white/10 rounded-2xl shadow-xl overflow-hidden">
      <div className="relative w-full h-96">
        <iframe
          src={`https://s.tradingview.com/widgetembed/?symbol=NASDAQ%3A${symbol}&interval=60&theme=dark&style=1&locale=en&toolbar_bg=%23f1f3f6&enable_publishing=false&allow_symbol_change=true&container_id=tradingview_chart`}
          className="w-full h-full border-0"
          title={`${symbol} Trading Chart`}
        />
      </div>
    </div>
  )
}
