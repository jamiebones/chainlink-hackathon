'use client'

import React from 'react'

interface Position {
  id: number
  asset: 'TSLA' | 'APPL'
  direction: 'Long' | 'Short'
  collateral: number
  leverage: number
  size: number
  entryPrice: number
  currentPrice: number
  pnl: number
  pnlPercentage: string
  fundingRate: number
}

const MOCK_POSITIONS: Position[] = [
  {
    id: 1,
    asset: 'TSLA',
    direction: 'Long',
    collateral: 100,
    leverage: 2,
    size: 200,
    entryPrice: 180.5,
    currentPrice: 185.25,
    pnl: 5.26,
    pnlPercentage: '+5.26%',
    fundingRate: -0.12
  },
  {
    id: 2,
    asset: 'APPL',
    direction: 'Short',
    collateral: 150,
    leverage: 3,
    size: 450,
    entryPrice: 190.0,
    currentPrice: 185.25,
    pnl: 11.84,
    pnlPercentage: '+7.89%',
    fundingRate: 0.18
  }
]

export default function PositionTable() {
  const handleClosePosition = (id: number) => {
    alert(`Closing position ${id}`)
  }

  const handleReducePosition = (id: number) => {
    alert(`Reducing position ${id}`)
  }

  if (MOCK_POSITIONS.length === 0) {
    return (
     <div className="bg-white/10 border border-white/10 rounded-2xl p-8 shadow-lg backdrop-blur-md">
        <h2 className="text-xl font-semibold text-yellow-400 mb-4">Open Positions</h2>
        <div className="text-center py-12">
          <div className="text-gray-500 text-lg mb-2">No open positions</div>
          <div className="text-gray-600 text-sm">Open your first position to see it here</div>
        </div>
      </div>
    )
  }

  return (
     <div className="bg-white/10 border border-white/10 rounded-2xl p-8 shadow-lg backdrop-blur-md">
      <h2 className="text-xl font-semibold text-yellow-400 mb-6">Open Positions</h2>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-300">Asset</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-300">Direction</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-300">Collateral</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-300">Leverage</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-300">Size</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-300">Entry Price</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-300">Current Price</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-300">PnL</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-300">Funding</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-300">Actions</th>
            </tr>
          </thead>
          <tbody>
            {MOCK_POSITIONS.map((position) => (
              <tr
                key={position.id}
                className="border-b border-gray-800 hover:bg-gray-800/50 transition-colors duration-200"
              >
                <td className="py-4 px-4 text-white font-medium">{position.asset}</td>
                <td className="py-4 px-4">
                  <span
                    className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                      position.direction === 'Long'
                        ? 'bg-green-900/30 text-green-400'
                        : 'bg-red-900/30 text-red-400'
                    }`}
                  >
                    {position.direction}
                  </span>
                </td>
                <td className="py-4 px-4 text-yellow-400">${position.collateral}</td>
                <td className="py-4 px-4 text-gray-300">{position.leverage}×</td>
                <td className="py-4 px-4 text-yellow-400">${position.size}</td>
                <td className="py-4 px-4 text-gray-300">${position.entryPrice.toFixed(2)}</td>
                <td className="py-4 px-4 text-gray-300">${position.currentPrice.toFixed(2)}</td>
                <td className="py-4 px-4">
                  <div className="flex flex-col">
                    <span
                      className={`font-medium ${
                        position.pnl >= 0 ? 'text-green-400' : 'text-red-400'
                      }`}
                    >
                      {position.pnl >= 0 ? '+' : ''}${position.pnl.toFixed(2)}
                    </span>
                    <span
                      className={`text-xs ${
                        position.pnl >= 0 ? 'text-green-400' : 'text-red-400'
                      }`}
                    >
                      {position.pnlPercentage}
                    </span>
                  </div>
                </td>
                <td className="py-4 px-4">
                  <span
                    className={`text-sm ${
                      position.fundingRate >= 0 ? 'text-green-400' : 'text-red-400'
                    }`}
                  >
                    {position.fundingRate >= 0 ? '+' : ''}${position.fundingRate.toFixed(2)}
                  </span>
                </td>
                <td className="py-4 px-4">
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleReducePosition(position.id)}
                      className="px-3 py-1 bg-yellow-600 text-white text-xs rounded-md hover:bg-yellow-500 transition-colors duration-200"
                    >
                      Reduce
                    </button>
                    <button
                      onClick={() => handleClosePosition(position.id)}
                      className="px-3 py-1 bg-red-600 text-white text-xs rounded-md hover:bg-red-500 transition-colors duration-200"
                    >
                      Close
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Summary Footer */}
      <div className="mt-6 p-4 rounded-lg border border-gray-600">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <div className="text-gray-400">Total Collateral</div>
            <div className="text-yellow-400 font-medium">
              ${MOCK_POSITIONS.reduce((sum, pos) => sum + pos.collateral, 0)}
            </div>
          </div>
          <div>
            <div className="text-gray-400">Total Size</div>
            <div className="text-yellow-400 font-medium">
              ${MOCK_POSITIONS.reduce((sum, pos) => sum + pos.size, 0)}
            </div>
          </div>
          <div>
            <div className="text-gray-400">Unrealized PnL</div>
            <div className={`font-medium ${
              MOCK_POSITIONS.reduce((sum, pos) => sum + pos.pnl, 0) >= 0
                ? 'text-green-400'
                : 'text-red-400'
            }`}>
              ${MOCK_POSITIONS.reduce((sum, pos) => sum + pos.pnl, 0).toFixed(2)}
            </div>
          </div>
          <div>
            <div className="text-gray-400">Daily Funding</div>
            <div className={`font-medium ${
              MOCK_POSITIONS.reduce((sum, pos) => sum + pos.fundingRate, 0) >= 0
                ? 'text-green-400'
                : 'text-red-400'
            }`}>
              ${MOCK_POSITIONS.reduce((sum, pos) => sum + pos.fundingRate, 0).toFixed(2)}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
