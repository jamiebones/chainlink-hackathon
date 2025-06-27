'use client'
import { useAccount } from 'wagmi'
import React, { useState } from 'react'
import { parseUnits } from 'viem'
import { useWriteContract,useReadContract } from 'wagmi'
import abiJson from '@/abis/PerpEngine.json'
import abiJson2 from '@/abis/MockERc20.json'
const PerpEngineABI = abiJson.abi
const usdcAbi = abiJson2.abi
const PerpAdd = '0xB9485C15cAF89Fb90be7CE14B336975F4FAE8D8f'
const UsdcAdd = '0xDD655EC06411cA3468E641A974d66804414Cb2A2'
type Direction = 'long' | 'short'
const ASSET_ENUM = {
  TSLA: 0,
  APPL: 1,
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
  // Fetch TSLA price from Chainlink Oracle
  const tslaPriceData = useReadContract({
    address: '0x671db3340e1f84257c263DBBd46bFE4D5ffA777E', // TSLAOracleManager
    abi: [
      {
        "inputs": [],
        "name": "getPriceTSLA",
        "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
        "stateMutability": "view",
        "type": "function"
      }
    ],
    functionName: 'getPriceTSLA',
    query: { refetchInterval: 1000 }
  })
  // Fetch AAPL price from Chainlink Oracle
  const aaplPriceData = useReadContract({
    address: '0xd91D3a89A24c305c8d8e6Fc34d19866a747496ba', // AAPLOracleManager
    abi: [
      {
        "inputs": [],
        "name": "getPriceAAPL",
        "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
        "stateMutability": "view",
        "type": "function"
      }
    ],
    functionName: 'getPriceAAPL',
    query: { refetchInterval: 1000 }
  })

  const rawPriceTSLA = tslaPriceData.data ? Number(tslaPriceData.data) / 100 : 0
  const rawPriceAAPL = aaplPriceData.data ? Number(aaplPriceData.data)/ 100 : 0
  const ENTRY_PRICE = symbol === 'TSLA' ? rawPriceTSLA : rawPriceAAPL
  const qty = parseFloat(quantity || '0')
  const lev = parseFloat(leverage || '1')
  const positionSize = qty * ENTRY_PRICE
  const leverageFactor = Math.round(lev * 1e6);
  const collateralRequired = positionSize * 1e6 / leverageFactor;
  const estimatedFee = positionSize * 0.001
  const liquidationPrice = lev ? (ENTRY_PRICE * (1 - 0.9 / lev)) : 0

  const { writeContractAsync } = useWriteContract()
  const { address: userAddress, isConnected } = useAccount()

const positionData = useReadContract({
  address: PerpAdd,
  abi: PerpEngineABI,
  functionName: 'getPosition',
  args: [userAddress, ASSET_ENUM[symbol]],
  query: {
    refetchInterval: 3000,
    enabled: isConnected,
  },
})

const hasPosition = positionData.data && positionData.data[0] > 0n
console.log("outside");
console.log(hasPosition);

const handleTrade = async () => {
  if (!isConnected) {
    alert('Please connect your wallet first.')
    return
  }

  if (qty <= 0 || positionSize <= 0 || collateralRequired <= 0) {
    alert(`Enter a valid ${symbol} quantity`)
    return
  }

  const assetId = ASSET_ENUM[symbol]
  const OPEN_FEE_BPS = 10
  const openFee = (positionSize * OPEN_FEE_BPS) / 10000
  const totalApproval = collateralRequired + openFee

  try {
    setIsLoading(true)

    // Approve USDC
    await writeContractAsync({
      address: UsdcAdd,
      abi: usdcAbi,
      functionName: 'approve',
      args: [
        PerpAdd, // PerpEngine
        parseUnits(totalApproval.toString(), 6),
      ],
    })

    const isLong  = positionData?.[4] ?? true

    

    const hasPosition = positionData.data && positionData.data[0] > 0n
    console.log(hasPosition);
    // CASE 1: no position → openPosition
    if (!hasPosition) {
      await writeContractAsync({
        address: PerpAdd,
        abi: PerpEngineABI,
        functionName: 'openPosition',
        args: [
          assetId,
          parseUnits(collateralRequired.toString(), 6),
          parseUnits(positionSize.toString(), 6),
          direction === 'long',
        ],
      })
    }

    // CASE 2: same direction → increase + addCollateral
    else if (isLong === (direction === 'long')) {
      await writeContractAsync({
        address: PerpAdd,
        abi: PerpEngineABI,
        functionName: 'addCollateral',
        args: [assetId, parseUnits(collateralRequired.toString(), 6)],
      })
      await writeContractAsync({
        address: PerpAdd,
        abi: PerpEngineABI,
        functionName: 'increasePosition',
        args: [
          assetId,
          parseUnits(positionSize.toString(), 6),
        ],
      })
    }

    // CASE 3: opposite direction → reduce + reduceCollateral
    else {
      await writeContractAsync({
        address: PerpAdd,
        abi: PerpEngineABI,
        functionName: 'addCollateral',
        args: [assetId, parseUnits(collateralRequired.toString(), 6)],
      })
      await writeContractAsync({
        address: PerpAdd,
        abi: PerpEngineABI,
        functionName: 'reducePosition',
        args: [
          assetId,
          parseUnits(positionSize.toString(), 6),
        ],
      })
    }

    alert('✅ Trade submitted')
    setQuantity('')
    setLeverage('1')
  } catch (err) {
    console.error(err)
    alert('❌ Trade failed')
  } finally {
    setIsLoading(false)
  }
}

  const handleClose = async () => {
    if (!isConnected) {
      alert('Please connect your wallet first.')
      return
    }
  
    try {
      setIsLoading(true)
      await writeContractAsync({
        address: '0xB9485C15cAF89Fb90be7CE14B336975F4FAE8D8f', // PerpEngine address
        abi: PerpEngineABI,
        functionName: 'closePosition',
        args: [ASSET_ENUM[symbol]],
      })
  
      alert('✅ Position closed')
    } catch (err) {
      console.error(err)
      alert('❌ Failed to close position')
    } finally {
      setIsLoading(false)
    }
  }
  if (symbol === 'TSLA' && tslaPriceData.isLoading) {
    return (
      <div className="text-white text-center py-10">Loading TSLA price from Chainlink...</div>
    )
  }
  if (symbol === 'APPL' && aaplPriceData.isLoading) {
    return (
      <div className="text-white text-center py-10">Loading APPL price from Chainlink...</div>
    )
  }

  return (
    <div className="bg-[#18181b]/90 border border-white/10 rounded-2xl overflow-hidden shadow-2xl backdrop-blur-md">
      <div className="p-4 border-b border-white/10 bg-[#18181b]/80">
        <h2 className="text-lg font-semibold text-white">Trade</h2>
      </div>
      <div className="p-4 space-y-6">
        {/* Direction Toggle */}
        <div className="flex bg-[#232329]/80 rounded-lg p-1 mb-4">
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
            className="w-full px-3 py-2  border border-white/10 rounded-lg text-white text-sm"
            placeholder="0.00"
          />
        </div>

        {/* Leverage */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-slate-300">Leverage</label>
            <span className="text-sm text-white font-medium">{leverage}x</span>
          </div>
          <input
            type="range"
            min="1"
            max="10"
            step="1"
            value={leverage}
            onChange={(e) => setLeverage(e.target.value)}
            className="w-full h-2 bg-white rounded-lg appearance-none cursor-pointer"
          />
          <div className="flex justify-between text-xs text-slate-500 mt-1">
            <span>1x</span>
            <span>5x</span>
            <span>10x</span>
          </div>
        </div>

        {/* Preview */}
        <div className="rounded-lg p-3 space-y-2">
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
              ? ' text-slate-500 cursor-not-allowed'
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
        {hasPosition && (
  <button
    onClick={handleClose}
    disabled={isLoading}
    className="w-full mt-3 py-3 rounded-lg font-medium text-sm bg-slate-700 text-white hover:bg-slate-600 transition-all duration-200"
  >
    {isLoading ? (
      <div className="flex items-center justify-center">
        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
        Closing...
      </div>
    ) : `Close ${symbol} Position`}
  </button>
)}


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
