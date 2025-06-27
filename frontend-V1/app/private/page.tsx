'use client';
import { useAccount } from 'wagmi';
import { useEffect, useState, useMemo } from 'react';
import { Wallet } from 'ethers';
import { CipherSuite, HkdfSha256 } from '@hpke/core';
import { DhkemX25519HkdfSha256 } from '@hpke/dhkem-x25519';
import { Chacha20Poly1305 } from '@hpke/chacha20poly1305';
import { useReadContract } from 'wagmi';
import MarketChart from '../components/MarketChart';
import abiJson2 from '@/abis/MockERc20.json'
import {useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
const usdcAbi = abiJson2.abi
const UsdcAdd = '0xDD655EC06411cA3468E641A974d66804414Cb2A2'
const ExAdd='0x14D24C79be77CD4fE8d544CAd5ab0b7b0aCd50Fe'
const suite = new CipherSuite({
  kem: new DhkemX25519HkdfSha256(),
  kdf: new HkdfSha256(),
  aead: new Chacha20Poly1305(),
});

function base64urlToUint8Array(base64url) {
  let b64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4) b64 += '=';
  const binary = typeof window !== 'undefined' ? window.atob(b64) : Buffer.from(b64, 'base64').toString('binary');
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; ++i) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export default function PrivateTradePage() {
  const [botPk, setBotPk] = useState(null);
  const [direction, setDirection] = useState('long');
  const [asset, setAsset] = useState('TSLA');
  const [quantity, setQuantity] = useState('');
  const [leverage, setLeverage] = useState('1');
  const [loading, setLoading] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');
  const [userBalance, setUserBalance] = useState<null | { total: string, available: string, locked: string }>(null); 
  const [balanceLoading, setBalanceLoading] = useState(true);
  const { address: userAddress } = useAccount();

  const tslaPriceData = useReadContract({
    address: '0x671db3340e1f84257c263DBBd46bFE4D5ffA777E',
    abi: [{ inputs: [], name: 'getPriceTSLA', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' }],
    functionName: 'getPriceTSLA',
    query: { refetchInterval: 1000 },
  });

  const aaplPriceData = useReadContract({
    address: '0xd91D3a89A24c305c8d8e6Fc34d19866a747496ba',
    abi: [{ inputs: [], name: 'getPriceAAPL', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' }],
    functionName: 'getPriceAAPL',
    query: { refetchInterval: 1000 },
  });

  const rawPriceTSLA = tslaPriceData.data ? Number(tslaPriceData.data) / 100 : 0;
  const rawPriceAAPL = aaplPriceData.data ? Number(aaplPriceData.data) / 100 : 0;
  const entryPrice = asset === 'TSLA' ? rawPriceTSLA : rawPriceAAPL;

  const { positionSize, collateralRequired, estimatedFee, liquidationPrice } = useMemo(() => {
    const qty = parseFloat(quantity || '0');
    const lev = parseFloat(leverage || '1');
    const posSize = qty * entryPrice;
    const levFactor = Math.round(lev);
    return {
      positionSize: posSize,
      collateralRequired: levFactor > 0 ? (posSize) / levFactor : 0,
      estimatedFee: posSize * 0.001,
      liquidationPrice: lev > 0 ? entryPrice * (1 - 0.9 / lev) : 0,
    };
  }, [quantity, leverage, entryPrice]);

  useEffect(() => {
    const fetchBalance = async () => {
      if (!userAddress) return;
      setBalanceLoading(true);
      try {
        const res = await fetch(`http://localhost:8080/balance/${userAddress}`);
        const json = await res.json();
        if (json.success) setUserBalance(json.balance);
      } catch (err) {
        console.error('❌ Failed to load balance:', err);
      } finally {
        setBalanceLoading(false);
      }
    };
    fetchBalance();
  }, [userAddress]);

  useEffect(() => {
    (async () => {
      try {
        await fetch('http://localhost:8080/setup/crypto', { method: 'POST' });
        const res = await fetch('http://localhost:8080/crypto/public-key');
        const json = await res.json();
        const pubkeyBytes = base64urlToUint8Array(json.publicKey);
        const pubkeyBuffer = pubkeyBytes.buffer.slice(pubkeyBytes.byteOffset, pubkeyBytes.byteOffset + pubkeyBytes.byteLength);
        const deserialized = await suite.kem.deserializePublicKey(pubkeyBuffer);
        setBotPk(deserialized);
      } catch (err) {
        console.error('❌ Error loading bot key:', err);
      }
    })();
  }, []);
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>(undefined);
  const { writeContractAsync } = useWriteContract();
  const { data: receipt, isLoading: txPending, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
    confirmations: 1,
  });

  const handleDeposit = async () => {
    if (!userAddress || !depositAmount || isNaN(Number(depositAmount)) || Number(depositAmount) <= 0) {
      return alert('Enter valid deposit amount');
    }
  
    try {
      const amountInUSDC = BigInt(Math.floor(Number(depositAmount) * 1e6));
  
      // Trigger USDC transfer
      const hash = await writeContractAsync({
        address: UsdcAdd,
        abi: usdcAbi,
        functionName: 'transfer',
        args: [ExAdd, amountInUSDC],
      });
  
      setTxHash(hash);
      alert('Transaction sent! Waiting for confirmation...');
    } catch (err) {
      console.error('❌ Transfer error:', err);
      alert('Transfer failed.');
    }
  };
  
  useEffect(() => {
    if (isSuccess && userAddress) {
      (async () => {
        try {
          const amountInUSDC = BigInt(Math.floor(Number(depositAmount) * 1e6));
          await fetch('http://localhost:8080/balance/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user: userAddress, amount: amountInUSDC.toString() }),
          });
          alert(`✅ ${depositAmount} USDC deposited!`);
          setDepositAmount('');
          const res = await fetch(`http://localhost:8080/balance/${userAddress}`);
          const json = await res.json();
          if (json.success) setUserBalance(json.balance);
        } catch (e) {
          console.error('❌ Backend sync failed:', e);
        }
      })();
    }
  }, [isSuccess]);
  

  const sendTrade = async () => {
    if (!botPk) return alert('Bot key not ready');
  
    try {
      const trader = Wallet.createRandom().address;
      const isLong = direction === 'long';
      const assetId = asset === 'TSLA' ? 0 : 1;
      console.log(userAddress);
      const sampleRes = await fetch('http://localhost:8080/trade/create-sample', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userAddress,
          assetId,
          qty: (positionSize * 1e6).toFixed(0),
          margin: Math.floor(collateralRequired * 1e6).toString(),
          isLong,
        }),
      });
  
      if (!sampleRes.ok) throw new Error('❌ create-sample failed');
      const sampleJson = await sampleRes.json();
      console.log('✅ Encrypted sample response:', sampleJson);
  
      const { enc, ct } = sampleJson.encrypted;
  
      const submitRes = await fetch('http://localhost:8080/trade/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enc, ct }),
      });
  
      if (!submitRes.ok) throw new Error('❌ trade/submit failed');
      console.log('✅ Trade submitted');
  
      alert('Trade submitted privately!');
      setQuantity('');
      setLeverage('1');
    } catch (err) {
      console.error('❌ sendTrade error:', err);
      alert('Trade failed: ' + err.message);
    }
  };
  

  return (
    <div className="px-4 xl:px-16 py-8">
      <div className="flex items-center justify-between bg-[#1f1f23] border border-white/10 rounded-2xl px-6 py-4 mb-6 shadow-md">
        <div>
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            🕶️ Incognito Mode
            <span className="text-sm font-normal text-slate-400">Private Trading Enabled</span>
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Your trade details and wallet address will remain hidden on-chain.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="number"
            min="0"
            step="0.01"
            value={depositAmount}
            onChange={(e) => setDepositAmount(e.target.value)}
            placeholder="Deposit USDC"
            className="w-32 px-3 py-2 border border-white/10 rounded-lg text-white text-sm bg-slate-800"
          />
          <button
            onClick={handleDeposit}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
          >
            Deposit
          </button>
          <div className="text-white text-sm">
            {balanceLoading
              ? 'Loading...'
              : userBalance
              ? `Available: ${(Number(userBalance.available) / 1e6).toFixed(2)} USDC`
              : 'Failed to load balance'}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        <div className="xl:col-span-3">
          <MarketChart symbol={asset === 'TSLA' ? 'TSLA' : 'AAPL'} />
        </div>
        <div className="bg-[#18181b]/90 border border-white/10 rounded-2xl p-6 shadow-2xl w-full">
          <h2 className="text-lg font-semibold text-white mb-4">Private Trade</h2>
          <div className="flex bg-[#232329]/80 rounded-lg p-1 mb-4">
            {['long', 'short'].map((d) => (
              <button
                key={d}
                onClick={() => setDirection(d)}
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

          <select
            value={asset}
            onChange={(e) => setAsset(e.target.value)}
            className="w-full mb-4 px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm"
          >
            <option value="TSLA">TSLA / USDC</option>
            <option value="APPL">APPL / USDC</option>
          </select>

          <input
            type="number"
            min="0"
            step="0.01"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="w-full px-3 py-2 mb-4 border border-white/10 rounded-lg text-white text-sm"
            placeholder="Quantity"
          />

          <input
            type="range"
            min="1"
            max="10"
            step="1"
            value={leverage}
            onChange={(e) => setLeverage(e.target.value)}
            className="w-full h-2 mb-2 bg-white rounded-lg appearance-none cursor-pointer"
          />
          <div className="text-sm text-white text-center mb-6">Leverage: {leverage}x</div>

          <div className="rounded-lg p-3 space-y-2 bg-[#232329]/60 mb-6">
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Entry Price</span>
              <span className="text-white">${entryPrice}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Collateral Required</span>
              <span className="text-yellow-400">${collateralRequired.toFixed(2)} USDC</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Estimated Fee</span>
              <span className="text-white">${estimatedFee.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Liq. Price</span>
              <span className="text-red-400">${liquidationPrice.toFixed(2)}</span>
            </div>
          </div>

          <button
            onClick={sendTrade}
            disabled={loading}
            className="w-full py-3 rounded-lg font-medium text-sm bg-pink-600 text-white hover:bg-pink-700"
          >
            {loading ? 'Processing...' : 'Send Private Trade'}
          </button>
        </div>
      </div>
    </div>
  );
}
