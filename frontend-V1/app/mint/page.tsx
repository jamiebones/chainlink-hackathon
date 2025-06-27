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

const VAULT_ADDRESS = "0x57ebC3E9B1260Ac811a33c0C54fD3611eC627144";

const assetLabelToEnum = {
  sTSLA: 0, 
  sAAPL: 1,
} as const;

type AssetLabel = keyof typeof assetLabelToEnum;

export default function MintPage() {
  const [shares, setShares] = useState('');
  const [assetType, setAssetType] = useState<AssetLabel>('sTSLA');
  const [simulationError, setSimulationError] = useState<string | null>(null);
  const [txError, setTxError] = useState<string | null>(null);
  
  const { address, isConnected } = useAccount();
  const { data: connectorClient } = useConnectorClient();

  // 1. Simulation hook - enabled only when wallet is connected
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
    functionName: 'openPosition',
    args: [
      assetLabelToEnum[assetType], 
      BigInt(Math.floor(Number(shares) * 1e18)), 
    ],
    query: { 
      enabled: false // We'll trigger manually
    }
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

  // Handle simulation errors
  useEffect(() => {
    if (simulationErrorRaw) {
      console.error("Simulation Error Details:", simulationErrorRaw);
      
      let errorMsg = 'Simulation failed';
      
      if (simulationErrorRaw instanceof BaseError) {
        // Extract contract revert reason
        const revertError = simulationErrorRaw.walk(err => 
          err instanceof BaseError && err.name === 'ContractFunctionExecutionError'
        );
        
        if (revertError) {
          errorMsg = revertError.shortMessage || revertError.message;
        } else {
          errorMsg = simulationErrorRaw.shortMessage || simulationErrorRaw.message;
        }
      }
      
      setSimulationError(errorMsg);
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

  // Trigger simulation when parameters change AND wallet is connected
  useEffect(() => {
    if (isConnected && connectorClient && shares && Number(shares) > 0) {
      simulateTransaction();
    } else {
      setSimulationError(null);
    }
  }, [shares, assetType, isConnected, connectorClient]);

  const handleOpenPosition = async () => {
    if (!isConnected) {
      alert('Connect your wallet first');
      return;
    }

    if (!shares || isNaN(Number(shares)) || Number(shares) <= 0) {
      alert('Enter a valid number of shares');
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
  if (isTxSuccess) statusMsg = 'Position opened successfully!';

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
          <label className="text-white/80 font-medium">Number of Shares</label>
          <input
            type="number"
            min="0.01"
            step="any"
            className="bg-[#232329] border border-white/10 rounded-xl px-4 py-3 text-lg text-white focus:outline-none disabled:opacity-50"
            placeholder="Enter amount"
            value={shares}
            onChange={e => setShares(e.target.value)}
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
          onClick={handleOpenPosition}
          disabled={
            !isConnected ||
            isSimulating || 
            isWritePending || 
            isTxLoading || 
            !shares || 
            !!simulationError
          }
        >
          {!isConnected ? 'Connect Wallet' : 
           isWritePending || isTxLoading ? 'Processing...' : 'Open Position'}
        </button>
        
        {/* Status and error messages */}
        <div className="min-h-[100px] flex flex-col gap-2">
          {simulationError && (
            <div className="text-red-400 p-3 bg-red-900/20 rounded-lg">
              <strong>Simulation Error:</strong> {simulationError}
              <div className="text-sm mt-1">
                {simulationError.includes('NotStarted') && 'Protocol not initialized - contact support'}
                {simulationError.includes('FeeReceiverNotSet') && 'Fee receiver not configured - contact support'}
                {simulationError.includes('InsufficientFundForPayout') && 'Insufficient USDC balance or allowance'}
                {simulationError.includes('CircuitBreaker') && 'Price feed issue - try again later'}
              </div>
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