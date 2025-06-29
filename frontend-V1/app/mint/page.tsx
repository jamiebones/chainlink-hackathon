'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import {
  useAccount,
  useWriteContract,
  useWalletClient,
  useWaitForTransactionReceipt,
  BaseError,
  useConnectorClient,
  useChainId 
} from 'wagmi';
import VaultABI from '../../utils/vault.json';
import vaultSenderAbi from '@/abis/VaultContractSender.json';
import { sepolia, avalancheFuji } from 'wagmi/chains';
const CHAINS = [
  { id: 43113, name: "Avalanche Fuji" },
  { id: 11155111, name: "Sepolia" },
];
// Constants
const FUJI_VAULT_ADDRESS = "0xFeFf49844Cf2bd6c07806f86FcDeFE55786De8a4"; // Updated to correct address
const ASSET_TYPES = {
  sTSLA: 0,
  sAAPL: 1,
} as const;
type AssetLabel = keyof typeof ASSET_TYPES;

const CCIP_CONFIG = {
  sepolia: {
    receiver: "0xDbA42976c2139Ccc9450a5867bFEb214892b8d4D",
    chainSelector: 14767482510784806043n,
    senderContract: "0x343d00b0c2fD67cA9dD1E34e2dA820F62f3f988F",
    usdcAddress: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
  }
};


export default function MintPage() {
  const chainId = useChainId();
  const chain = CHAINS.find(c => c.id === chainId);
  console.log('Current chain:', chain?.name);
  const [shares, setShares] = useState('');
  const [assetType, setAssetType] = useState<AssetLabel>('sTSLA');
  const [transactionError, setTransactionError] = useState('');
  const [selectedChain, setSelectedChain] = useState<'fuji' | 'sepolia'>('fuji');
  const [ccipData, setCcipData] = useState<{ hash?: string, error?: string }>({});

  // Wallet hooks
  const { address, isConnected } = useAccount();
  const { data: connectorClient } = useConnectorClient();
  const { data: walletClient } = useWalletClient();

  // Transaction hooks
  const {
    writeContract,
    error: writeError,
    isPending: isWritePending,
    data: hash
  } = useWriteContract();
  const txReceipt = useWaitForTransactionReceipt({ hash });

  // Error handling effects
  useEffect(() => {
    const error = writeError || txReceipt.error;
    if (error) {
      setTransactionError(extractErrorMessage(error));
    } else if (txReceipt.isSuccess) {
      setTransactionError('');
    }
  }, [writeError, txReceipt.error, txReceipt.isSuccess]);

  // Transaction execution
  const handleOpenPosition = async () => {
    if (!validateInputs()) return;

    setTransactionError('');
    setCcipData({});
    try {
      if (chain?.name === 'Sepolia') {
        await executeCcipTransaction();
      } else {
        executeDirectTransaction();
      }
    } catch (error: any) {
      setTransactionError(error.message || 'Transaction failed');
    }
  };

  // Helper functions
  function validateInputs() {
    if (!isConnected || !connectorClient) {
      alert('Connect your wallet first');
      return false;
    }
    if (!shares || isNaN(Number(shares)) || Number(shares) <= 0) {
      alert('Enter a valid number of shares');
      return false;
    }
    return true;
  }

  function extractErrorMessage(error: unknown): string {
    if (!error) return '';
    if (error instanceof BaseError) {
      const revertError = error.walk(err =>
        err instanceof BaseError && err.name === 'ContractFunctionExecutionError'
      );
      // Ensure shortMessage is accessed safely
      return revertError?.shortMessage || (error as BaseError).shortMessage || error.message;
    }
    return error instanceof Error ? error.message : String(error);
  };
      const liquidityPool= "0xD24FB6ebc087604af93D536B5A4562A0Dfa6Ab3a"
      const perpEngine= "0xC707f6C9625B97FD9a214953528dfd846c2b2dD7"
      const executeDirectTransaction = async () => {
    if (!walletClient) throw new Error('Wallet client unavailable');
    const provider = new ethers.BrowserProvider(walletClient.transport);
    const signer = await provider.getSigner();

    const vault = new ethers.Contract(FUJI_VAULT_ADDRESS, VaultABI.abi, signer);
    const usdcAddress = "0x5425890298aed601595a70AB815c96711a31Bc65";
    const usdc = new ethers.Contract(usdcAddress, ["function approve(address,uint256) returns (bool)"], signer);

    const approveAmount = BigInt(Math.floor(Number(shares) * 1e20));
    const approveTx = await usdc.approve(FUJI_VAULT_ADDRESS, approveAmount);
    await approveTx.wait();

    const mainTx = await vault.openPosition(
      ASSET_TYPES[assetType],
      BigInt(Math.floor(Number(shares) * 1e6))
    );

    const receipt = await mainTx.wait();
    setCcipData({ hash: receipt.transactionHash });
};


  const executeCcipTransaction = useCallback(async () => {
    try {
      const { usdcAddress, senderContract, receiver, chainSelector } = CCIP_CONFIG.sepolia;
      const usdcAmount = BigInt(Math.floor(Number(shares) * 10 ** 6));

      if (!walletClient) throw new Error('Wallet client unavailable');
      if (!address) throw new Error('No connected address');

      const provider = new ethers.BrowserProvider(walletClient.transport);
      const signer = await provider.getSigner();

      // USDC Approval
      const usdc = new ethers.Contract(usdcAddress, [
        "function approve(address, uint256) returns (bool)"
      ], signer);

      const approveTx = await usdc.approve(senderContract, usdcAmount);
      await approveTx.wait();

      // CCIP Position Opening
      const vaultSender = new ethers.Contract(senderContract, vaultSenderAbi, signer);

      const positionRequest = {
        asset: ASSET_TYPES[assetType],
        amount: usdcAmount,
        recipient: address,
        fujiChainSelector: chainSelector,
        fujiReceiver: receiver
      };
      const ccipTx = await vaultSender.openPositionViaCCIP(positionRequest);
      const receipt = await ccipTx.wait();

      setCcipData({ hash: receipt.hash });
      alert("Position submitted via CCIP successfully!");
    } catch (error: any) {
      setCcipData({ error: error.message || 'CCIP transaction failed' });
      throw error;
    }
  }, [shares, assetType, address, walletClient]);

  // Status messages & explorer link
  const getStatusMessage = () => {
    if (isWritePending) return 'Confirming in wallet...';
    if (txReceipt.isLoading) return 'Processing transaction...';
    if (txReceipt.isSuccess) return 'Position opened successfully!';
    if (ccipData.hash) return 'CCIP transaction completed!';
    return '';
  };
  const getExplorerLink = () => {
    if (chain?.name === 'Avalanche Fuji' && txReceipt.isSuccess && hash) {
      return `https://testnet.snowtrace.io/tx/${hash}`;
    }
    if (chain?.name === 'Sepolia' && ccipData.hash) {
      return `https://sepolia.etherscan.io/tx/${ccipData.hash}`;
    }
    return null;
  };

  const explorerLink = getExplorerLink();
  const statusMessage = getStatusMessage();
  const isProcessing = isWritePending || txReceipt.isLoading;
  const isDisabled = !isConnected || isProcessing || !shares;

  return (
    <div className="min-h-screen flex items-center justify-center relative bg-[#111014] font-[Inter,sans-serif] overflow-hidden">
      {/* Soft Uniswap background */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <div className="absolute -top-24 -left-32 w-[540px] h-[400px] bg-gradient-to-tr from-pink-400/20 via-blue-400/10 to-transparent rounded-full blur-3xl" />
        <div className="absolute top-2/3 right-1/4 w-[380px] h-[320px] bg-gradient-to-br from-purple-400/20 via-indigo-400/10 to-transparent rounded-full blur-2xl" />
        <div className="absolute top-1/4 left-2/3 w-[280px] h-[200px] bg-gradient-to-tl from-fuchsia-400/15 via-white/0 to-transparent rounded-full blur-2xl" />
      </div>

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

          {/* Action button */}
          <button
            className="mt-4 bg-pink-500 hover:bg-pink-400 transition-all text-white font-bold text-lg py-3 rounded-2xl shadow-lg focus:outline-none focus:ring-2 focus:ring-pink-400/40 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleOpenPosition}
            disabled={isDisabled}
          >
            {!isConnected ? 'Connect Wallet' :
             isProcessing ? 'Processing...' : 'Open Position'}
          </button>

          {/* Status and error messages */}
          <div className="min-h-[100px] flex flex-col gap-2">
            {transactionError && (
              <div className="text-red-400 p-3 bg-red-900/20 rounded-lg">
                <strong>Transaction Error:</strong> {transactionError}
              </div>
            )}

            {statusMessage && (
              <div className={`text-center p-3 rounded-lg ${
                txReceipt.isSuccess || ccipData.hash ? 'bg-green-900/20 text-green-400' : 'text-blue-400'
              }`}>
                {statusMessage}
              </div>
            )}

            {explorerLink && (
              <a
                href={explorerLink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:underline text-center"
              >
                {chain?.name === 'Avalanche Fuji' ? 'View on Snowtrace' : 'View on Etherscan'}
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
