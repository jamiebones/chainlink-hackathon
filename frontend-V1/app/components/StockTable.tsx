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
    <div className="max-w-6xl mx-auto" style={{ marginTop: '40px' }}>
      <div className="flex justify-between items-center mb-6">
        <h2 style={{ 
          fontSize: '24px', 
          color: '#fff',
          fontWeight: '600'
        }}>
          Synthetic Stocks
        </h2>
      </div>

      <div style={{
        background: 'rgba(17, 25, 40, 0.75)',
        borderRadius: '16px',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        overflow: 'hidden'
      }}>
        <table style={{
          width: '100%',
          borderCollapse: 'separate',
          borderSpacing: '0',
          color: '#fff',
        }}>
          <thead>
            <tr style={{ 
              background: 'rgba(255, 255, 255, 0.02)',
              borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
            }}>
              <th style={{ 
                padding: '16px', 
                textAlign: 'left',
                fontSize: '14px',
                color: 'rgba(255, 255, 255, 0.7)',
                fontWeight: '500',
                letterSpacing: '0.05em',
              }}>Token</th>
              <th style={{ 
                padding: '16px', 
                textAlign: 'left',
                fontSize: '14px',
                color: 'rgba(255, 255, 255, 0.7)',
                fontWeight: '500',
                letterSpacing: '0.05em',
              }}>Stock</th>
              <th style={{ 
                padding: '16px', 
                textAlign: 'right',
                fontSize: '14px',
                color: 'rgba(255, 255, 255, 0.7)',
                fontWeight: '500',
                letterSpacing: '0.05em',
              }}>Price</th>
            </tr>
          </thead>
          <tbody>
            {MOCK_STOCKS.map((stock) => (
              <tr
                key={stock.symbol}
                onClick={() => setSelectedSymbol(stock.symbol)}
                style={{
                  cursor: 'pointer',
                  background: selectedSymbol === stock.symbol 
                    ? 'rgba(255, 255, 255, 0.05)'
                    : 'transparent',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                  transition: 'all 0.2s ease-in-out',
                }}
                onMouseEnter={(e) => {
                  if (selectedSymbol !== stock.symbol) {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedSymbol !== stock.symbol) {
                    e.currentTarget.style.background = 'transparent'
                  }
                }}
              >
                <td style={{ 
                  padding: '20px 16px',
                  fontSize: '15px',
                  fontWeight: '500',
                  fontFamily: 'monospace',
                  color: '#3B82F6'
                }}>{stock.symbol}</td>
                <td style={{ 
                  padding: '20px 16px',
                  fontSize: '15px',
                }}>{stock.name}</td>
                <td style={{ 
                  padding: '20px 16px',
                  fontSize: '15px',
                  textAlign: 'right',
                  fontWeight: '500'
                }}>${stock.price.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedSymbol && (
        <div
          style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setSelectedSymbol(null)}
        >
          <div
            style={{
              background: 'rgba(17, 25, 40, 0.95)',
              padding: '32px',
              borderRadius: '16px',
              maxWidth: '90%',
              maxHeight: '90%',
              overflow: 'hidden',
              position: 'relative',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setSelectedSymbol(null)}
              style={{
                position: 'absolute',
                top: '20px',
                right: '20px',
                fontSize: '24px',
                background: 'transparent',
                color: 'rgba(255, 255, 255, 0.7)',
                border: 'none',
                cursor: 'pointer',
                width: '36px',
                height: '36px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '50%',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
              }}
            >
              ✕
            </button>

            <h3 style={{ 
              fontSize: '24px', 
              marginBottom: '24px',
              color: '#fff',
              fontWeight: '600'
            }}>
              {selectedSymbol} Price Chart
            </h3>
            <iframe
              src={`https://s.tradingview.com/widgetembed/?symbol=NASDAQ%3A${selectedSymbol.replace('s', '')}&interval=60&theme=dark`}
              width="800"
              height="500"
              style={{ 
                border: 'none',
                borderRadius: '12px',
                overflow: 'hidden'
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
