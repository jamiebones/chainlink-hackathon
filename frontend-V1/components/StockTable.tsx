'use client'
import React, { useState } from 'react'

const MOCK_STOCKS = [
  { symbol: 'sTSLA', name: 'Tesla', price: 178.2 },
  { symbol: 'sAAPL', name: 'Apple', price: 192.5 },
  { symbol: 'sGOOGL', name: 'Google', price: 2820.7 },
  { symbol: 'sMSFT', name: 'Microsoft', price: 310.1 },
]

export default function StockTable() {
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null)

  return (
    <div style={{ marginTop: '60px' }}>
      <h2 style={{ fontSize: '24px', color: '#FFD700', marginBottom: '16px' }}>
        Synthetic Stock Dashboard
      </h2>

      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          backgroundColor: '#2d004d', // dark purple
          color: '#FFD700', // golden yellow
          border: '1px solid #5e1d84',
        }}
      >
        <thead>
          <tr style={{ background: '#3a0066' }}>
            <th style={{ padding: '12px', borderBottom: '1px solid #5e1d84' }}>Token</th>
            <th style={{ padding: '12px', borderBottom: '1px solid #5e1d84' }}>Stock</th>
            <th style={{ padding: '12px', borderBottom: '1px solid #5e1d84' }}>Price</th>
          </tr>
        </thead>
        <tbody>
          {MOCK_STOCKS.map((stock) => (
            <tr
            key={stock.symbol}
            onClick={() => setSelectedSymbol(stock.symbol)}
            style={{
              cursor: 'pointer',
              background: selectedSymbol === stock.symbol ? '#4a0078' : '#2d004d',
              color: '#FFD700',
              transition: 'all 0.2s ease-in-out',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#5e1d84'
              e.currentTarget.style.transform = 'scale(1.01)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = selectedSymbol === stock.symbol ? '#4a0078' : '#2d004d'
              e.currentTarget.style.transform = 'scale(1.0)'
            }}
          >
          
              <td style={{ padding: '12px', borderBottom: '1px solid #5e1d84' }}>{stock.symbol}</td>
              <td style={{ padding: '12px', borderBottom: '1px solid #5e1d84' }}>{stock.name}</td>
              <td style={{ padding: '12px', borderBottom: '1px solid #5e1d84' }}>${stock.price.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* 🔮 Modal */}
      {selectedSymbol && (
        <div
          style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setSelectedSymbol(null)}
        >
          <div
            style={{
              background: '#2d004d',
              padding: '24px',
              borderRadius: '8px',
              maxWidth: '90%',
              maxHeight: '90%',
              overflow: 'hidden',
              position: 'relative',
              border: '1px solid #FFD700',
              color: '#FFD700',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setSelectedSymbol(null)}
              style={{
                position: 'absolute',
                top: 10,
                right: 12,
                fontSize: '18px',
                background: 'transparent',
                color: '#FFD700',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              ✕
            </button>

            <h3 style={{ fontSize: '20px', marginBottom: '12px' }}>
              {selectedSymbol} Price Chart
            </h3>
            <iframe
              src={`https://s.tradingview.com/widgetembed/?symbol=NASDAQ%3A${selectedSymbol.replace('s', '')}&interval=60&theme=dark`}
              width="600"
              height="400"
              style={{ border: 'none' }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
