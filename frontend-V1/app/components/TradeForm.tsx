'use client'
import { useAccount } from 'wagmi'
import React, { useState } from 'react'
import { parseUnits } from 'viem'
import { useWriteContract } from 'wagmi'
import abiJson from '@/abis/PerpEngine.json'
import abiJson2 from '@/abis/MockERc20.json'
const PerpEngineABI = abiJson.abi
const usdcAbi = abiJson2.abi
type Direction = 'long' | 'short'
const ASSET_ENUM = {
  TSLA: 0,
  APPL: 1,
}

const PRICE_MAP: Record<'TSLA' | 'APPL', number> = {
  TSLA: 185.25,
  APPL: 197.60,
}

export default function TradeForm({
  symbol,
  setSymbol
}: {
  symbol: 'TSLA' | 'APPL',
  setSymbol: React.Dispatch<React.SetStateAction<'TSLA' | 'APPL'>>
}) {
  const [direction, setDirection] = useState<Direction>('long')
  const [leverage, setLeverage] = useState('1')
  const [quantity, setQuantity] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const ENTRY_PRICE = PRICE_MAP[symbol]
  const qty = parseFloat(quantity || '0')
  const lev = parseFloat(leverage || '1')
  const positionSize = qty * ENTRY_PRICE
  const leverageFactor = Math.round(lev * 1e6);
  const collateralRequired = positionSize * 1e6 / leverageFactor;
  const estimatedFee = positionSize * 0.001
  const liquidationPrice = lev ? (ENTRY_PRICE * (1 - 0.9 / lev)) : 0

  const { writeContractAsync } = useWriteContract()
  const { isConnected } = useAccount()
  console.log('Collateral:', collateralRequired)
  console.log('Size USD:', positionSize)
  console.log('Expected Leverage:', positionSize / collateralRequired)

  const handleTrade = async () => {
    if (!isConnected) {
      alert('Please connect your wallet first.')
      return
    }

    if (qty <= 0) {
      alert(`Enter a valid ${symbol} quantity`)
      return
    }
    const OPEN_FEE_BPS = 10 // 10 bps = 0.1%
    const openFee = (positionSize * OPEN_FEE_BPS) / 10000
    const totalApproval = collateralRequired + openFee
    
    try {
      setIsLoading(true)
      await writeContractAsync({
        address: '0xDD655EC06411cA3468E641A974d66804414Cb2A2',
        abi: usdcAbi,
        functionName: 'approve',
        args: [
          '0xB9485C15cAF89Fb90be7CE14B336975F4FAE8D8f', // PerpEngine address
          parseUnits(totalApproval.toString(), 6),
        ],
      })
      await writeContractAsync({
        address: '0xB9485C15cAF89Fb90be7CE14B336975F4FAE8D8f',
        abi: PerpEngineABI,
        functionName: 'openPosition',
        args: [
          ASSET_ENUM[symbol],
          parseUnits(collateralRequired.toString(), 6),
          parseUnits(positionSize.toString(), 6),
          direction === 'long',
        ],
      })

      alert('Trade submitted!')
      setQuantity('')
      setLeverage('1')
    } catch (err) {
      console.error(err)
      alert('Transaction failed')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden">
      <div className="p-4 border-b border-slate-700 bg-slate-800/50">
        <h2 className="text-lg font-semibold text-white">Trade</h2>
      </div>

      <div className="p-4 space-y-6">
        {/* Direction Toggle */}
        <div className="flex bg-slate-800 rounded-lg p-1 mb-4">
          {['long', 'short'].map((d) => (
            <button
              key={d}
              onClick={() => setDirection(d as Direction)}
              className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
                direction === d
                  ? d === 'long'
                    ? 'bg-green-500 text-white shadow-lg'
                    : 'bg-red-500 text-white shadow-lg'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700'
              }`}
            >
              {d.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Market Dropdown */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Market</label>
          <select
            value={symbol}
            onChange={(e) => setSymbol(e.target.value as 'TSLA' | 'APPL')}
            className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm"
          >
            <option value="TSLA">TSLA / USDC</option>
            <option value="APPL">APPL / USDC</option>
          </select>
        </div>

        {/* Quantity Input */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-slate-300">Buy Amount</label>
            <span className="text-xs text-slate-400">{symbol}</span>
          </div>
          <input
            type="number"
            min="0"
            step="0.01"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm"
            placeholder="0.00"
          />
        </div>

        {/* Leverage */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-slate-300">Leverage</label>
            <span className="text-sm text-blue-400 font-medium">{leverage}x</span>
          </div>
          <input
            type="range"
            min="1"
            max="10"
            step="1"
            value={leverage}
            onChange={(e) => setLeverage(e.target.value)}
            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
          />
          <div className="flex justify-between text-xs text-slate-500 mt-1">
            <span>1x</span>
            <span>5x</span>
            <span>10x</span>
          </div>
        </div>

        {/* Preview */}
        <div className="bg-slate-800 rounded-lg p-3 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Entry Price</span>
            <span className="text-white">${ENTRY_PRICE}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">{symbol} Quantity</span>
            <span className="text-white">{qty || '0.00'}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Position Size</span>
            <span className="text-white">${positionSize.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Collateral Required</span>
            <span className="text-yellow-400">${collateralRequired.toFixed(2)} USDC</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Fee</span>
            <span className="text-white">${estimatedFee.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Liq. Price</span>
            <span className="text-red-400">${liquidationPrice.toFixed(2)}</span>
          </div>
        </div>

        {/* Submit */}
        <button
          onClick={handleTrade}
          disabled={isLoading || qty <= 0}
          className={`w-full py-3 rounded-lg font-medium text-sm transition-all duration-200 ${
            isLoading || qty <= 0
              ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
              : direction === 'long'
              ? 'bg-green-500 text-white hover:bg-green-600'
              : 'bg-red-500 text-white hover:bg-red-600'
          }`}
        >
          {isLoading ? (
            <div className="flex items-center justify-center">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
              Processing...
            </div>
          ) : `${direction === 'long' ? 'Long' : 'Short'} ${symbol}`}
        </button>

        {/* Risk warning */}
        <div className="p-3 bg-amber-900/20 border border-amber-800 rounded-lg text-xs text-amber-300 flex space-x-2">
          <svg className="w-4 h-4 text-amber-400 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <p>Leverage trading involves substantial risk of loss and is not suitable for all investors.</p>
        </div>
      </div>
    </div>
  )
}
