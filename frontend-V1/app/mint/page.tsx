'use client';

import React, { useState } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import VaultABI from '../../utils/vault.json'

const VAULT_ADDRESS = "0x8907688286438B6Cc36F8d63De348dCd6278cFc1"; // <--- REPLACE with your address

const assetLabelToEnum = {
  sTSLA: 0, 
  sAAPL: 1,
} as const;

type AssetLabel = keyof typeof assetLabelToEnum;

export default function MintPage() {
  const [shares, setShares] = useState('');
  const [assetType, setAssetType] = useState<AssetLabel>('sTSLA');
  const [submittedTx, setSubmittedTx] = useState<string | null>(null);

  const { address } = useAccount();

  
  const { data: hash, error, isPending, writeContract } = useWriteContract();
  const { isLoading: txLoading, isSuccess: txSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  // Handler to open position
  const handleOpenPosition = async () => {
    if (!address) {
      alert('Connect your wallet');
      return;
    }

    if (!shares || isNaN(Number(shares)) || Number(shares) <= 0) {
      alert('Enter a valid number of shares');
      return;
    }

    try {
      writeContract({
        address: VAULT_ADDRESS,
        abi: VaultABI.abi,
        functionName: 'openPosition',
        args: [
          assetLabelToEnum[assetType], 
          BigInt(Math.floor(Number(shares) * 1e18)), 
        ],
      });
    } catch (err) {
      if (err && typeof err === 'object' && 'message' in err) {
        alert('Transaction error: ' + (err as { message: string }).message);
      } else {
        alert('Transaction error: Unknown error');
      }
    }
  };

 
  let statusMsg = '';
  if (isPending || txLoading) statusMsg = 'Transaction pending...';
  if (txSuccess) statusMsg = 'Position opened!';

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#111112] relative overflow-hidden">
      {/* Background balls */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <div className="absolute top-1/4 left-1/4 w-48 h-48 bg-pink-500 opacity-30 blur-3xl rounded-full" />
        <div className="absolute top-2/3 left-2/3 w-40 h-40 bg-yellow-400 opacity-20 blur-3xl rounded-full" />
        <div className="absolute top-1/2 left-1/2 w-32 h-32 bg-blue-400 opacity-20 blur-3xl rounded-full" />
        <div className="absolute top-1/3 left-2/3 w-36 h-36 bg-green-400 opacity-20 blur-3xl rounded-full" />
      </div>
      <div className="relative z-10 w-full max-w-md mx-auto rounded-3xl bg-[#18181b]/90 border border-white/10 shadow-2xl p-8 flex flex-col gap-6 backdrop-blur-md">
        <h2 className="text-2xl font-bold text-white mb-2 text-center">Open Position</h2>
        <div className="flex flex-col gap-4">
          <label className="text-white/80 font-medium">Asset</label>
          <select
            className="bg-[#232329] border border-white/10 rounded-xl px-4 py-3 text-lg text-white focus:outline-none"
            value={assetType}
            onChange={e => setAssetType(e.target.value as AssetLabel)}
          >
            <option value="sTSLA">sTSLA</option>
            <option value="sAAPL">sAAPL</option>
          </select>
        </div>
        <div className="flex flex-col gap-4">
          <label className="text-white/80 font-medium">Number of Shares</label>
          <input
            type="number"
            min="0"
            step="any"
            className="bg-[#232329] border border-white/10 rounded-xl px-4 py-3 text-lg text-white focus:outline-none"
            placeholder="Enter amount"
            value={shares}
            onChange={e => setShares(e.target.value)}
          />
        </div>
        <button
          className="mt-4 bg-pink-500 hover:bg-pink-400 transition-all text-white font-bold text-lg py-3 rounded-2xl shadow-lg focus:outline-none focus:ring-2 focus:ring-pink-400/40"
          onClick={handleOpenPosition}
          disabled={isPending || txLoading || !shares || !address}
        >
          {isPending || txLoading ? 'Opening...' : 'Open Position'}
        </button>
        <div className="mt-2 min-h-6 text-center text-white/80 text-sm">
          {error && <span className="text-red-400">Error: {error.message}</span>}
          {statusMsg}
        </div>
      </div>
    </div>
  );
}
