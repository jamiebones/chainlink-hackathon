import { useUserPositions } from '../hooks/useUserPositions' // adjust path

export default function PositionTable() {
  const { positions, loading } = useUserPositions()

  const handleClosePosition = (id: string) => {
    alert(`Closing position ${id}`)
  }

  const handleReducePosition = (id: string) => {
    alert(`Reducing position ${id}`)
  }

  if (loading) {
    return <div className="text-gray-500 p-6">Loading positions...</div>
  }
  console.log(positions);
  if (!positions || positions.length === 0) {
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
            {positions.map((position) => (
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
                <td className="py-4 px-4 text-gray-300">${Number(position.entryPrice).toFixed(2)}</td>
                <td className="py-4 px-4 text-gray-300">${Number(position.currentPrice).toFixed(2)}</td>
                <td className="py-4 px-4">
                  <div className="flex flex-col">
                    <span
                      className={`font-medium ${
                        position.pnl >= 0 ? 'text-green-400' : 'text-red-400'
                      }`}
                    >
                      {position.pnl >= 0 ? '+' : ''}${Number(position.pnl).toFixed(2)}
                    </span>
                  </div>
                </td>
                <td className="py-4 px-4 text-gray-300">${Number(position.fundingRate).toFixed(2)}</td>
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
    </div>
  )
}
