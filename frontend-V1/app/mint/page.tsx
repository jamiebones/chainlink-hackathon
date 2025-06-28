'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import {
  useAccount,
  useWriteContract,
  useWalletClient,
  useWaitForTransactionReceipt,
  useConnectorClient,
  useChainId
} from 'wagmi';
import VaultABI from '../../utils/vault.json';
import vaultSenderAbi from '@/abis/VaultContractSender.json';
import { sepolia, avalancheFuji } from 'wagmi/chains';

// Constants (update as needed)
const VAULT_ADDRESS = "0x561B0fcC18D09dBa76c68Fa0910AcFf58A1EF6E2";
const ASSET_TYPES = { sTSLA: 0, sAAPL: 1 } as const;
type AssetLabel = keyof typeof ASSET_TYPES;

const CCIP_CONFIG = {
  sepolia: {
    receiver: "0x60D5A7f7f49D307e36AadAd994EF2e164a42BA54",
    chainSelector: 14767482510784806043n,
    senderContract: "0xC29534f3B12658E58FEf15a454A284eC271C7297",
    usdcAddress: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
    decimals: 6
  }
};

const CHAINS = [sepolia, avalancheFuji];

export default function MintPage() {
  const chainId = useChainId();
  const chain = CHAINS.find(c => c.id === chainId);
  const [shares, setShares] = useState('');
  const [assetType, setAssetType] = useState<AssetLabel>('sTSLA');
  const [simulationError, setSimulationError] = useState('');
  const [transactionError, setTransactionError] = useState('');
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
        executeLocalTransaction();
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
    // @ts-ignore
    return error.shortMessage || error.message || String(error);
  }

  function executeLocalTransaction() {
    writeContract({
      address: VAULT_ADDRESS,
      abi: VaultABI.abi,
      functionName: 'openPosition',
      args: [ASSET_TYPES[assetType], BigInt(Math.floor(Number(shares) * 1e18))]
    });
  }

  const executeCcipTransaction = useCallback(async () => {
    try {
      const { usdcAddress, senderContract, receiver, chainSelector } = CCIP_CONFIG.sepolia;
      const usdcAmount = BigInt(Math.floor(Number(shares) * 10 ** 6));
      if (!walletClient) throw new Error('Wallet client unavailable');

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
        recipient: address!,
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
      return `https://ccip.chain.link/#/side-drawer/msg/${ccipData.hash}`;
    }
    return null;
  };

  const explorerLink = getExplorerLink();
  const statusMessage = getStatusMessage();
  const isProcessing = isWritePending || txReceipt.isLoading;
  const isDisabled = !isConnected || isProcessing || !shares || !!simulationError;

  return (
    <div className="min-h-screen flex items-center justify-center relative bg-[#111014] font-[Inter,sans-serif] overflow-hidden">
      {/* Soft Uniswap background */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <div className="absolute -top-24 -left-32 w-[540px] h-[400px] bg-gradient-to-tr from-pink-400/20 via-blue-400/10 to-transparent rounded-full blur-3xl" />
        <div className="absolute top-2/3 right-1/4 w-[380px] h-[320px] bg-gradient-to-br from-purple-400/20 via-indigo-400/10 to-transparent rounded-full blur-2xl" />
        <div className="absolute top-1/4 left-2/3 w-[280px] h-[200px] bg-gradient-to-tl from-fuchsia-400/15 via-white/0 to-transparent rounded-full blur-2xl" />
      </div>
      <div className="relative z-10 w-full max-w-md mx-auto glassy-card p-8 flex flex-col gap-7 rounded-2xl shadow-2xl bg-white/10 backdrop-blur-xl border border-white/10">
        <h2 className="text-2xl font-extrabold text-white mb-2 text-center tracking-tight" style={{ fontFamily: 'Inter, Geist, sans-serif' }}>
          Open Position
        </h2>
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
          <label className="text-white/80 font-medium">
            {chain?.name === "Sepolia" ? "USDC Amount" : "Number of Shares"}
          </label>
          <input
            type="number"
            min="0.01"
            step="any"
            className="w-full rounded-lg bg-black/20 border border-white/15 px-4 py-2 text-white/90 focus:ring-2 focus:ring-pink-400/40 placeholder:text-white/30"
            placeholder="Enter value"
            value={shares}
            onChange={e => setShares(e.target.value)}
            disabled={!isConnected}
          />
        </div>
        <button
          className={`w-full mt-2 px-6 py-3 rounded-lg bg-gradient-to-r from-pink-400/80 to-blue-400/80 text-white text-lg font-bold shadow-md transition-all 
            ${isDisabled ? "opacity-50 cursor-not-allowed" : "hover:scale-105 hover:shadow-xl"}
          `}
          onClick={handleOpenPosition}
          disabled={isDisabled}
        >
          {!isConnected ? 'Connect Wallet' :
            isProcessing ? 'Processing...' : 'Open Position'}
        </button>
        {/* Status and error messages */}
        <div className="min-h-[60px] flex flex-col gap-2">
          {simulationError && (
            <div className="text-red-400 p-3 bg-red-900/20 rounded-lg text-sm">
              <strong>Simulation Error:</strong> {simulationError}
            </div>
          )}
          {(transactionError || ccipData.error) && (
            <div className="text-red-400 p-3 bg-red-900/20 rounded-lg text-sm">
              <strong>Transaction Error:</strong> {transactionError || ccipData.error}
            </div>
          )}
          {statusMessage && (
            <div className={`text-center p-3 rounded-lg text-base font-semibold ${txReceipt.isSuccess || ccipData.hash ? 'bg-green-900/20 text-green-400' : 'text-blue-400'}`}>
              {statusMessage}
            </div>
          )}
          {explorerLink && (
            <a
              href={explorerLink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:underline text-center text-sm"
            >
              {chain?.name === 'Avalanche Fuji' ? 'View on Snowtrace' : 'View on CCIP Explorer'}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}





















// // 'use client';

// import React, { useState, useEffect } from 'react';
// import { ethers } from 'ethers';
// import { 
//   useAccount, 
//   useWriteContract,
//   useWalletClient, 
//   useWaitForTransactionReceipt, 
//   useSimulateContract,
//   BaseError,
//   useConnectorClient
// } from 'wagmi';
// import VaultABI from '../../utils/vault.json';
// import vaultSenderAbi from '@/abis/VaultContractSender.json'


// const VAULT_ADDRESS = "0x57ebC3E9B1260Ac811a33c0C54fD3611eC627144";
// const fujiDestinatorSelector = "";
// const receiverContractOnFuji = "";
// const erc20TokenAbi = [
//   "function balanceOf(address account) view returns (uint256)",
//   "function transfer(address to, uint256 amount) returns (bool)",
//   "function approve(address spender, uint256 amount) returns (bool)",
//   "function allowance(address owner, address spender) view returns (uint256)"
// ];

// const assetLabelToEnum = {
//   sTSLA: 0, 
//   sAAPL: 1,
// } as const;

// type AssetLabel = keyof typeof assetLabelToEnum;

// export default function MintPage() {
//   const [shares, setShares] = useState('');
//   const [assetType, setAssetType] = useState<AssetLabel>('sTSLA');
//   const [simulationError, setSimulationError] = useState<string | null>(null);
//   const [txError, setTxError] = useState<string | null>(null);
//   const [selectedChain, setSelectedChain] = useState<'fuji' | 'sepolia'>('fuji');

//   const { address, isConnected } = useAccount();
//   const { data: connectorClient } = useConnectorClient();
//   const { data: walletClient } = useWalletClient();

//   const { 
//     data: simulationData, 
//     error: simulationErrorRaw, 
//     isFetching: isSimulating,
//   } = useSimulateContract({
//     address: VAULT_ADDRESS,
//     abi: VaultABI.abi,
//     functionName: 'openPosition',
//     args: [
//       assetLabelToEnum[assetType], 
//       BigInt(Math.floor(Number(shares) * 1e18)), 
//     ],
//     query: { enabled: false }
//   });

//   const { 
//     writeContract, 
//     error: writeError, 
//     isPending: isWritePending, 
//     data: hash 
//   } = useWriteContract();

//   const { 
//     isLoading: isTxLoading, 
//     isSuccess: isTxSuccess,
//     error: txErrorRaw
//   } = useWaitForTransactionReceipt({ hash });

//   useEffect(() => {
//     if (
//       isConnected &&
//       connectorClient &&
//       shares &&
//       Number(shares) > 0 &&
//       selectedChain === 'fuji'
//     ) {
//       simulateTransaction();
//     } else {
//       setSimulationError(null);
//     }
//   }, [shares, assetType, isConnected, connectorClient, selectedChain]);

//   useEffect(() => {
//     if (simulationErrorRaw) {
//       let errorMsg = 'Simulation failed';
//       if (simulationErrorRaw instanceof BaseError) {
//         const revertError = simulationErrorRaw.walk(err => 
//           err instanceof BaseError && err.name === 'ContractFunctionExecutionError'
//         );
//         if (revertError) {
//           errorMsg = revertError.shortMessage || revertError.message;
//         } else {
//           errorMsg = simulationErrorRaw.shortMessage || simulationErrorRaw.message;
//         }
//       }
//       setSimulationError(errorMsg);
//     } else {
//       setSimulationError(null);
//     }
//   }, [simulationErrorRaw]);

//   useEffect(() => {
//     if (writeError || txErrorRaw) {
//       const error = writeError || txErrorRaw;
//       let errorMsg = 'Transaction failed';
//       if (error instanceof BaseError) {
//         const revertError = error.walk(err => 
//           err instanceof BaseError && err.name === 'ContractFunctionExecutionError'
//         );
//         errorMsg = revertError?.shortMessage || error.shortMessage || error.message;
//       }
//       setTxError(errorMsg);
//     } else {
//       setTxError(null);
//     }
//   }, [writeError, txErrorRaw]);

//   const handleOpenPosition = async () => {
//     if (!isConnected || !connectorClient) {
//       alert('Connect your wallet first');
//       return;
//     }
//     if (!shares || isNaN(Number(shares)) || Number(shares) <= 0) {
//       alert('Enter a valid number of shares');
//       return;
//     }

//     if (selectedChain === 'sepolia') {
//       try {
//         const usdcAmount = BigInt(Math.floor(Number(shares) * 1e6)); // assuming USDC 6 decimals
//         const vaultSenderAddress = address;
//         const receiverAddressFuji = "0x60D5A7f7f49D307e36AadAd994EF2e164a42BA54";
//         const fujiSelector = 14767482510784806043n;
//         const sepoliaSourceContract = "0xC29534f3B12658E58FEf15a454A284eC271C7297";

//         if (!walletClient) {
//           alert('Wallet client not available — check your connection.');
//           return;
//         }

//         const provider = new ethers.BrowserProvider(walletClient.transport);
//         const signer = await provider.getSigner();

//         const vaultSender = new ethers.Contract(sepoliaSourceContract, vaultSenderAbi, signer);
//         const usdc = new ethers.Contract("0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238", erc20TokenAbi, signer);

//         const allowanceTx = await usdc.approve(vaultSenderAddress, usdcAmount);
//         await allowanceTx.wait();

//         const positionRequest = {
//           asset: assetLabelToEnum[assetType],
//           amount: usdcAmount,
//           recipient: address,
//           fujiChainSelector: fujiSelector,
//           fujiReceiver: receiverAddressFuji
//         };

//         const ccipTx = await vaultSender.openPositionViaCCIP(positionRequest);
//         await ccipTx.wait();

//         alert("CCIP position submitted successfully!");
//       } catch (err: any) {
//         console.error("CCIP Error:", err);
//         alert(`CCIP failed: ${err.message || 'Unknown error'}`);
//       }
//     } else {
//       if (simulationData?.request) {
//         writeContract(simulationData.request);
//       } else {
//         alert('Please wait for simulation to complete');
//       }
//     }
//   };

//   let statusMsg = '';
//   if (isSimulating) statusMsg = 'Simulating transaction...';
//   if (isWritePending) statusMsg = 'Confirming in wallet...';
//   if (isTxLoading) statusMsg = 'Processing transaction...';
//   if (isTxSuccess) statusMsg = 'Position opened successfully!';

//   return (
//     <>
//       <div className="flex flex-col gap-4">
//         <label className="text-white/80 font-medium">Target Chain</label>
//         <select
//           className="bg-[#232329] border border-white/10 rounded-xl px-4 py-3 text-lg text-white focus:outline-none disabled:opacity-50"
//           value={selectedChain}
//           onChange={e => setSelectedChain(e.target.value as 'fuji' | 'sepolia')}
//           disabled={!isConnected}
//         >
//           <option value="fuji">Avalanche Fuji</option>
//           <option value="sepolia">Ethereum Sepolia</option>
//         </select>
//       </div>

//     <div className="min-h-screen flex items-center justify-center bg-[#111112] relative overflow-hidden">
//       {/* Background balls */}
//       <div className="absolute inset-0 pointer-events-none z-0">
//         <div className="absolute top-1/4 left-1/4 w-48 h-48 bg-pink-500 opacity-30 blur-3xl rounded-full" />
//         <div className="absolute top-2/3 left-2/3 w-40 h-40 bg-yellow-400 opacity-20 blur-3xl rounded-full" />
//         <div className="absolute top-1/2 left-1/2 w-32 h-32 bg-blue-400 opacity-20 blur-3xl rounded-full" />
//         <div className="absolute top-1/3 left-2/3 w-36 h-36 bg-green-400 opacity-20 blur-3xl rounded-full" />
//       </div>
      
//       <div className="relative z-10 w-full max-w-md mx-auto rounded-3xl bg-[#18181b]/90 border border-white/10 shadow-2xl p-8 flex flex-col gap-6 backdrop-blur-md">
//         <h2 className="text-2xl font-bold text-white mb-2 text-center">Open Position</h2>
        
//         {!isConnected && (
//           <div className="text-center py-4 text-yellow-400">
//             Connect your wallet to begin
//           </div>
//         )}
        
//         <div className="flex flex-col gap-4">
//           <label className="text-white/80 font-medium">Asset</label>
//           <select
//             className="bg-[#232329] border border-white/10 rounded-xl px-4 py-3 text-lg text-white focus:outline-none disabled:opacity-50"
//             value={assetType}
//             onChange={e => setAssetType(e.target.value as AssetLabel)}
//             disabled={!isConnected}
//           >
//             <option value="sTSLA">sTSLA</option>
//             <option value="sAAPL">sAAPL</option>
//           </select>
//         </div>
        
//         <div className="flex flex-col gap-4">
//           <label className="text-white/80 font-medium">Number of Shares</label>
//           <input
//             type="number"
//             min="0.01"
//             step="any"
//             className="bg-[#232329] border border-white/10 rounded-xl px-4 py-3 text-lg text-white focus:outline-none disabled:opacity-50"
//             placeholder="Enter amount"
//             value={shares}
//             onChange={e => setShares(e.target.value)}
//             disabled={!isConnected}
//           />
//         </div>
        
//         {/* Simulation status */}
//         {isConnected && isSimulating && (
//           <div className="text-yellow-400 text-sm text-center">
//             Verifying transaction parameters...
//           </div>
//         )}
        
//         {/* Action button */}
//         <button
//           className="mt-4 bg-pink-500 hover:bg-pink-400 transition-all text-white font-bold text-lg py-3 rounded-2xl shadow-lg focus:outline-none focus:ring-2 focus:ring-pink-400/40 disabled:opacity-50 disabled:cursor-not-allowed"
//           onClick={handleOpenPosition}
//           disabled={
//             !isConnected ||
//             isSimulating || 
//             isWritePending || 
//             isTxLoading || 
//             !shares || 
//             !!simulationError
//           }
//         >
//           {!isConnected ? 'Connect Wallet' : 
//            isWritePending || isTxLoading ? 'Processing...' : 'Open Position'}
//         </button>
        
//         {/* Status and error messages */}
//         <div className="min-h-[100px] flex flex-col gap-2">
//           {simulationError && (
//             <div className="text-red-400 p-3 bg-red-900/20 rounded-lg">
//               <strong>Simulation Error:</strong> {simulationError}
//               <div className="text-sm mt-1">
//                 {simulationError.includes('NotStarted') && 'Protocol not initialized - contact support'}
//                 {simulationError.includes('FeeReceiverNotSet') && 'Fee receiver not configured - contact support'}
//                 {simulationError.includes('InsufficientFundForPayout') && 'Insufficient USDC balance or allowance'}
//                 {simulationError.includes('CircuitBreaker') && 'Price feed issue - try again later'}
//               </div>
//             </div>
//           )}
          
//           {txError && (
//             <div className="text-red-400 p-3 bg-red-900/20 rounded-lg">
//               <strong>Transaction Error:</strong> {txError}
//             </div>
//           )}
          
//           {statusMsg && (
//             <div className={`text-center p-3 rounded-lg ${
//               isTxSuccess ? 'bg-green-900/20 text-green-400' : 'text-blue-400'
//             }`}>
//               {statusMsg}
//             </div>
//           )}
          
//           {isTxSuccess && hash && (
//             <a 
//               href={`https://testnet.snowtrace.io/tx/${hash}`} 
//               target="_blank"
//               rel="noopener noreferrer"
//               className="text-blue-400 hover:underline text-center"
//             >
//               View on Snowtrace
//             </a>
//           )}
//         </div>
//       </div>
//     </div>
//     </>
//   );
// }