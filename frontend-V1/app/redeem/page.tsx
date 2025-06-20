'use client';

import React, { useState, useEffect } from 'react';
import { 
  useAccount, 
  useWriteContract, 
  useWaitForTransactionReceipt, 
  useSimulateContract,
  BaseError,
  useConnectorClient
} from 'wagmi';
import VaultABI from '../../utils/vault.json';

const VAULT_ADDRESS = "0x57ebC3E9B1260Ac811a33c0C54fD3611eC627144"; // Change to your vault address

const assetLabelToEnum = {
  sTSLA: 0, 
  sAAPL: 1,
} as const;

type AssetLabel = keyof typeof assetLabelToEnum;

export default function RedeemStockPage() {
  const [stockToRedeem, setStockToRedeem] = useState('');
  const [assetType, setAssetType] = useState<AssetLabel>('sTSLA');
  const [simulationError, setSimulationError] = useState<string | null>(null);
  const [txError, setTxError] = useState<string | null>(null);

  const { address, isConnected } = useAccount();
  const { data: connectorClient } = useConnectorClient();

  // 1. Simulate redeemStock
  const { 
    data: simulationData, 
    error: simulationErrorRaw, 
    isError: isSimulationError,
    refetch: simulateTransaction,
    isFetching: isSimulating,
    status: simulationStatus
  } = useSimulateContract({
    address: VAULT_ADDRESS,
    abi: VaultABI.abi,
    functionName: 'redeemStock',
    args: [
      assetLabelToEnum[assetType],
      BigInt(Math.floor(Number(stockToRedeem) * 1e18)),
    ],
    query: { enabled: false }
  });

  // 2. Write contract hook
  const { 
    writeContract, 
    error: writeError, 
    isPending: isWritePending, 
    data: hash 
  } = useWriteContract();

  // 3. Transaction receipt hook
  const { 
    isLoading: isTxLoading, 
    isSuccess: isTxSuccess,
    error: txErrorRaw
  } = useWaitForTransactionReceipt({ hash });

  // Handle simulation errors (improved extraction)
  useEffect(() => {
    if (simulationErrorRaw) {
      let errorMsg = 'Simulation failed';
      let rawMsg = '';

      if (simulationErrorRaw instanceof BaseError) {
        // Walk nested errors (wagmi-style)
        const revertError = simulationErrorRaw.walk(err =>
          err instanceof BaseError && err.name === 'ContractFunctionExecutionError'
        );
        if (revertError) {
          errorMsg = revertError.shortMessage || revertError.message;
          rawMsg = revertError.message || '';
        } else {
          errorMsg = simulationErrorRaw.shortMessage || simulationErrorRaw.message;
          rawMsg = simulationErrorRaw.message || '';
        }
        // Sometimes error is in .cause
        if (simulationErrorRaw.cause?.message) {
          rawMsg = simulationErrorRaw.cause.message;
        }
      } else {
        // Fallback plain JS Error
        errorMsg = simulationErrorRaw.message || String(simulationErrorRaw);
        rawMsg = simulationErrorRaw.message || String(simulationErrorRaw);
      }

      // Try to extract revert reason from raw message
      // This covers most Hardhat/Ethers/Metamask error formats
      const revertReasonMatch = rawMsg.match(/revert\s([^\n"]+)/);
      if (revertReasonMatch && revertReasonMatch[1]) {
        errorMsg = revertReasonMatch[1];
      }

      // Optional: Human-friendly mapping
      if (errorMsg.includes('NotStarted')) errorMsg = 'Protocol not initialized. Contact support.';
      if (errorMsg.includes('FeeReceiverNotSet')) errorMsg = 'Fee receiver not configured. Contact support.';
      if (errorMsg.toLowerCase().includes('insufficient')) errorMsg = 'Insufficient balance or allowance.';
      if (errorMsg.toLowerCase().includes('circuit breaker')) errorMsg = 'Market circuit breaker triggered. Try again later.';

      setSimulationError(errorMsg);
      // Dev: see full error object in console
      console.error("Simulation Error Details:", simulationErrorRaw);
    } else {
      setSimulationError(null);
    }
  }, [simulationErrorRaw]);

  // Handle transaction errors (same style as simulation)
  useEffect(() => {
    if (writeError || txErrorRaw) {
      const error = writeError || txErrorRaw;
      let errorMsg = 'Transaction failed';
      if (error instanceof BaseError) {
        const revertError = error.walk(err => 
          err instanceof BaseError && err.name === 'ContractFunctionExecutionError'
        );
        errorMsg = revertError?.shortMessage || error.shortMessage || error.message;
      }
      setTxError(errorMsg);
    } else {
      setTxError(null);
    }
  }, [writeError, txErrorRaw]);

  // Trigger simulation when parameters change AND wallet is connected
  useEffect(() => {
    if (isConnected && connectorClient && stockToRedeem && Number(stockToRedeem) > 0) {
      simulateTransaction();
    } else {
      setSimulationError(null);
    }
  }, [stockToRedeem, assetType, isConnected, connectorClient]);

  const handleRedeemStock = async () => {
    if (!isConnected) {
      alert('Connect your wallet first');
      return;
    }
    if (!stockToRedeem || isNaN(Number(stockToRedeem)) || Number(stockToRedeem) <= 0) {
      alert('Enter a valid amount to redeem');
      return;
    }
    // If simulation was successful, write contract
    if (simulationData?.request) {
      writeContract(simulationData.request);
    } else {
      alert('Please wait for simulation to complete');
    }
  };

  // Status messages
  let statusMsg = '';
  if (isSimulating) statusMsg = 'Simulating transaction...';
  if (isWritePending) statusMsg = 'Confirming in wallet...';
  if (isTxLoading) statusMsg = 'Processing transaction...';
  if (isTxSuccess) statusMsg = 'Stock redeemed successfully!';

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
        <h2 className="text-2xl font-bold text-white mb-2 text-center">Redeem Stock</h2>
        
        {!isConnected && (
          <div className="text-center py-4 text-yellow-400">
            Connect your wallet to begin
          </div>
        )}
        
        <div className="flex flex-col gap-4">
          <label className="text-white/80 font-medium">Asset</label>
          <select
            className="bg-[#232329] border border-white/10 rounded-xl px-4 py-3 text-lg text-white focus:outline-none disabled:opacity-50"
            value={assetType}
            onChange={e => setAssetType(e.target.value as AssetLabel)}
            disabled={!isConnected}
          >
            <option value="sTSLA">sTSLA</option>
            <option value="sAAPL">sAAPL</option>
          </select>
        </div>
        
        <div className="flex flex-col gap-4">
          <label className="text-white/80 font-medium">Stock to Redeem</label>
          <input
            type="number"
            min="0.01"
            step="any"
            className="bg-[#232329] border border-white/10 rounded-xl px-4 py-3 text-lg text-white focus:outline-none disabled:opacity-50"
            placeholder="Enter amount"
            value={stockToRedeem}
            onChange={e => setStockToRedeem(e.target.value)}
            disabled={!isConnected}
          />
        </div>
        
        {/* Simulation status */}
        {isConnected && isSimulating && (
          <div className="text-yellow-400 text-sm text-center">
            Verifying transaction parameters...
          </div>
        )}
        
        {/* Action button */}
        <button
          className="mt-4 bg-pink-500 hover:bg-pink-400 transition-all text-white font-bold text-lg py-3 rounded-2xl shadow-lg focus:outline-none focus:ring-2 focus:ring-pink-400/40 disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={handleRedeemStock}
          disabled={
            !isConnected ||
            isSimulating || 
            isWritePending || 
            isTxLoading || 
            !stockToRedeem || 
            !!simulationError
          }
        >
          {!isConnected ? 'Connect Wallet' : 
           isWritePending || isTxLoading ? 'Processing...' : 'Redeem Stock'}
        </button>
        
        {/* Status and error messages */}
        <div className="min-h-[100px] flex flex-col gap-2">
          {simulationError && (
            <div className="text-red-400 p-3 bg-red-900/20 rounded-lg">
              <strong>Simulation Error:</strong> {simulationError}
            </div>
          )}
          {txError && (
            <div className="text-red-400 p-3 bg-red-900/20 rounded-lg">
              <strong>Transaction Error:</strong> {txError}
            </div>
          )}
          {statusMsg && (
            <div className={`text-center p-3 rounded-lg ${
              isTxSuccess ? 'bg-green-900/20 text-green-400' : 'text-blue-400'
            }`}>
              {statusMsg}
            </div>
          )}
          {isTxSuccess && hash && (
            <a 
              href={`https://testnet.snowtrace.io/tx/${hash}`} 
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:underline text-center"
            >
              View on Snowtrace
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
