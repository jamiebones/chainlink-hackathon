'use client'

import React from 'react'
import { gql, useQuery } from '@apollo/client'
import { useAccount } from 'wagmi'
import { formatUnits } from 'viem'

const GET_USER_POSITIONS = gql`
  query GetUserPositions($trader: Bytes!) {
    positions(where: { trader: $trader, isActive: true }) {
      id
      assetType
      bufferCollateral
      hedgedCollateral
      entryPrice
      timestamp
    }
  }
`

export default function PositionTable() {
  const { address } = useAccount()
  const { data, loading, error } = useQuery(GET_USER_POSITIONS, {
    variables: { trader: address },
    skip: !address,
  })

  if (loading) return <div className="text-white">Loading positions...</div>
  if (error) return <div className="text-red-500">Error loading positions</div>
  console.log(data);
  const positions = data?.positions ?? []

  if (positions.length === 0) {
    return (
      <div className="border border-gray-700 rounded-xl p-6">
        <h2 className="text-xl font-semibold text-yellow-400 mb-4">Open Positions</h2>
        <div className="text-center py-12">
          <div className="text-gray-500 text-lg mb-2">No open positions</div>
          <div className="text-gray-600 text-sm">Open your first position to see it here</div>
        </div>
      </div>
    )
  }

  return (
    <div className="border border-gray-700 rounded-xl p-6">
      <h2 className="text-xl font-semibold text-yellow-400 mb-6">Open Positions</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left text-white">
          <thead className="text-xs uppercase text-gray-400 border-b border-gray-700">
            <tr>
              <th className="py-3 px-4">Asset</th>
              <th className="py-3 px-4">Collateral</th>
              <th className="py-3 px-4">Size</th>
              <th className="py-3 px-4">Entry Price</th>
              <th className="py-3 px-4">Opened At</th>
              <th className="py-3 px-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {positions.map((pos: any, i: number) => (
              <tr key={i} className="border-b border-gray-800 hover:bg-gray-800/50 transition-colors duration-200">
                <td className="py-4 px-4 font-medium">{pos.assetType}</td>
                <td className="py-4 px-4 text-yellow-400">${formatUnits(BigInt(pos.bufferCollateral), 6)}</td>
                <td className="py-4 px-4 text-yellow-400">${formatUnits(BigInt(pos.hedgedCollateral), 6)}</td>
                <td className="py-4 px-4 text-gray-300">${formatUnits(BigInt(pos.entryPrice), 18).slice(0, 6)}</td>
                <td className="py-4 px-4 text-gray-300">
                  {new Date(Number(pos.timestamp) * 1000).toLocaleDateString()}
                </td>
                <td className="py-4 px-4">
                  <div className="flex space-x-2">
                    <button className="px-3 py-1 bg-yellow-600 text-white text-xs rounded-md hover:bg-yellow-500">
                      Reduce
                    </button>
                    <button className="px-3 py-1 bg-red-600 text-white text-xs rounded-md hover:bg-red-500">
                      Close
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
