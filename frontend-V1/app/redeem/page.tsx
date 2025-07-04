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

const VAULT_ADDRESS = "0xFeFf49844Cf2bd6c07806f86FcDeFE55786De8a4";

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

  // Simulate redeemStock
  const { 
    data: simulationData, 
    error: simulationErrorRaw, 
    isError: isSimulationError,
    refetch: simulateTransaction,
    isFetching: isSimulating
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

  // Write contract hook
  const { 
    writeContract, 
    error: writeError, 
    isPending: isWritePending, 
    data: hash 
  } = useWriteContract();

  // Transaction receipt hook
  const { 
    isLoading: isTxLoading, 
    isSuccess: isTxSuccess,
    error: txErrorRaw
  } = useWaitForTransactionReceipt({ hash });

  // Handle simulation errors
  useEffect(() => {
    if (simulationErrorRaw) {
      let errorMsg = 'Simulation failed';
      let rawMsg = '';

      if (simulationErrorRaw instanceof BaseError) {
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
        if (simulationErrorRaw.cause?.message) {
          rawMsg = simulationErrorRaw.cause.message;
        }
      } else {
        errorMsg = simulationErrorRaw.message || String(simulationErrorRaw);
        rawMsg = simulationErrorRaw.message || String(simulationErrorRaw);
      }

      const revertReasonMatch = rawMsg.match(/revert\s([^\n"]+)/);
      if (revertReasonMatch && revertReasonMatch[1]) {
        errorMsg = revertReasonMatch[1];
      }

      if (errorMsg.includes('NotStarted')) errorMsg = 'Protocol not initialized. Contact support.';
      if (errorMsg.includes('FeeReceiverNotSet')) errorMsg = 'Fee receiver not configured. Contact support.';
      if (errorMsg.toLowerCase().includes('insufficient')) errorMsg = 'Insufficient balance or allowance.';
      if (errorMsg.toLowerCase().includes('circuit breaker')) errorMsg = 'Market circuit breaker triggered. Try again later.';

      setSimulationError(errorMsg);
      console.error("Simulation Error Details:", simulationErrorRaw);
    } else {
      setSimulationError(null);
    }
  }, [simulationErrorRaw]);

  // Handle transaction errors
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

  // Trigger simulation on input change
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
    if (simulationData?.request) {
      writeContract(simulationData.request);
    } else {
      alert('Please wait for simulation to complete');
    }
  };

  // Status message
  let statusMsg = '';
  if (isSimulating) statusMsg = 'Simulating transaction...';
  if (isWritePending) statusMsg = 'Confirming in wallet...';
  if (isTxLoading) statusMsg = 'Processing transaction...';
  if (isTxSuccess) statusMsg = 'Stock redeemed successfully!';

  return (
    <div className="min-h-screen relative bg-gradient-to-br from-black via-slate-950/80 to-gray-950 overflow-hidden font-sans flex items-center justify-center">
      {/* Animated star field */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute -top-32 -left-40 w-[600px] h-[500px] bg-gradient-to-tr from-purple-500/30 via-blue-600/15 to-transparent rounded-full blur-3xl animate-pulse" />
        <div className="absolute top-2/3 right-1/4 w-[450px] h-[380px] bg-gradient-to-br from-pink-500/25 via-purple-400/10 to-transparent rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/4 left-2/3 w-[350px] h-[280px] bg-gradient-to-tl from-cyan-400/20 via-blue-300/5 to-transparent rounded-full blur-2xl animate-pulse" style={{ animationDelay: '2s' }} />
        <div className="absolute bottom-1/4 left-1/4 w-[300px] h-[250px] bg-gradient-to-tr from-emerald-400/15 via-teal-300/8 to-transparent rounded-full blur-2xl animate-pulse" style={{ animationDelay: '0.5s' }} />
      </div>
      <div className="relative z-10 w-full max-w-md mx-auto glassy-card p-8 border border-slate-800/60 shadow-2xl backdrop-blur-xl">
        <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-purple-200 to-blue-200 mb-2 text-center tracking-tight">Redeem Synth</h1>
        <p className="text-slate-400 mb-8 text-base font-medium text-center">
          Redeem your synthetic assets for USDC.
        </p>
        {!isConnected && (
          <div className="text-center py-4 text-yellow-300 bg-yellow-500/10 rounded-lg font-medium">
            Connect your wallet to begin
          </div>
        )}
        <div className="flex flex-col gap-2">
          <label className="text-white/80 font-medium">Asset</label>
          <select
            className="w-full rounded-lg bg-black/20 border border-white/15 px-4 py-2 text-white/90 focus:ring-2 focus:ring-pink-400/40"
            value={assetType}
            onChange={e => setAssetType(e.target.value as AssetLabel)}
            disabled={!isConnected}
          >
            <option value="sTSLA">sTSLA</option>
            <option value="sAAPL">sAAPL</option>
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-white/80 font-medium">Stock to Redeem</label>
          <input
            type="number"
            min="0.01"
            step="any"
            className="w-full rounded-lg bg-black/20 border border-white/15 px-4 py-2 text-white/90 focus:ring-2 focus:ring-pink-400/40 placeholder:text-white/30"
            placeholder="Enter amount"
            value={stockToRedeem}
            onChange={e => setStockToRedeem(e.target.value)}
            disabled={!isConnected}
          />
        </div>
        {/* Action button */}
        <button
          className={`w-full mt-2 px-6 py-3 rounded-lg bg-gradient-to-r from-pink-400/80 to-blue-400/80 text-white text-lg font-bold shadow-md transition-all 
            ${!isConnected || isSimulating || isWritePending || isTxLoading || !stockToRedeem || !!simulationError ? "opacity-50 cursor-not-allowed" : "hover:scale-105 hover:shadow-xl"}
          `}
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
        <div className="min-h-[70px] flex flex-col gap-2">
          {simulationError && (
            <div className="text-red-400 p-3 bg-red-900/20 rounded-lg text-sm">
              <strong>Simulation Error:</strong> {simulationError}
            </div>
          )}
          {txError && (
            <div className="text-red-400 p-3 bg-red-900/20 rounded-lg text-sm">
              <strong>Transaction Error:</strong> {txError}
            </div>
          )}
          {statusMsg && (
            <div className={`text-center p-3 rounded-lg text-base font-semibold ${isTxSuccess ? 'bg-green-900/20 text-green-400' : 'text-blue-400'}`}>
              {statusMsg}
            </div>
          )}
          {isTxSuccess && hash && (
            <a 
              href={`https://testnet.snowtrace.io/tx/${hash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:underline text-center text-sm"
            >
              View on Snowtrace
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
