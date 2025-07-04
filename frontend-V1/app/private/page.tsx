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
const UsdcAdd = '0x5425890298aed601595a70AB815c96711a31Bc65'
const ExAdd = '0x40BDC27880A522B4346844A96aDAB92DcEDB1664'
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
  const [positions, setPositions] = useState([]);
  const [positionsLoading, setPositionsLoading] = useState(true);
  const { address: userAddress } = useAccount();

  const fetchPositions = async () => {
    if (!userAddress) return;
    setPositionsLoading(true);
    try {
      const res = await fetch(`http://localhost:8080/position/${userAddress}`);
      const json = await res.json();
      if (json.success && json.positions) {
        setPositions(json.positions);
      }
    } catch (err) {
      console.error('❌ Failed to fetch positions:', err);
    } finally {
      setPositionsLoading(false);
    }
  };

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
    fetchPositions();
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
      collateralRequired: levFactor > 0 ? posSize / levFactor : 0,
      estimatedFee: posSize * 0.001,
      liquidationPrice: lev > 0 ? entryPrice * (1 - 0.9 / lev) : 0,
    };
  }, [quantity, leverage, entryPrice]);

  const { writeContractAsync } = useWriteContract();
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>(undefined);
  const { isSuccess } = useWaitForTransactionReceipt({ hash: txHash, confirmations: 1 });

  const handleDeposit = async () => {
    if (!userAddress || !depositAmount || isNaN(Number(depositAmount)) || Number(depositAmount) <= 0) {
      return alert('Enter valid deposit amount');
    }
    try {
      const amountInUSDC = BigInt(Math.floor(Number(depositAmount) * 1e6));
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
      const assetId = asset === 'TSLA' ? 0 : 1;
      const sampleRes = await fetch('http://localhost:8080/trade/create-sample', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trader: userAddress,
          assetId,
          qty: (positionSize * 1e6).toFixed(0),
          margin: Math.floor(collateralRequired * 1e6).toString(),
          isLong: direction === 'long',
        }),
      });
      const sampleJson = await sampleRes.json();
      const { enc, ct } = sampleJson.encrypted;
      await fetch('http://localhost:8080/trade/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enc, ct }),
      });
      alert('Trade submitted privately!');
      setQuantity('');
      setLeverage('1');
      fetchPositions();
    } catch (err) {
      console.error('❌ sendTrade error:', err);
      alert('Trade failed: ' + err.message);
    }
  };

  const handleClosePosition = async () => {
    try {
      const assetId = asset === 'TSLA' ? 0 : 1;
      const createRes = await fetch('http://localhost:8080/trade/create-close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trader: userAddress,
          assetId,
          closePercent: 100,
        }),
      });
      const createJson = await createRes.json();
      const { enc, ct } = createJson.encrypted;
      await fetch('http://localhost:8080/trade/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enc, ct }),
      });
      alert('Position closed successfully!');
      fetchPositions();
    } catch (err) {
      console.error('❌ handleClosePosition error:', err);
      alert('Close failed: ' + err.message);
    }
  };

  return (
    <div className="min-h-screen relative bg-black overflow-hidden font-sans flex items-center justify-center">
      {/* Cosmic animated background gradients (EXACT same as landing page) */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute -top-32 -left-40 w-[600px] h-[500px] bg-gradient-to-tr from-purple-500/40 via-blue-600/20 to-transparent rounded-full blur-3xl animate-pulse" />
        <div className="absolute top-2/3 right-1/4 w-[450px] h-[380px] bg-gradient-to-br from-pink-500/30 via-purple-400/15 to-transparent rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/4 left-2/3 w-[350px] h-[280px] bg-gradient-to-tl from-cyan-400/25 via-blue-300/10 to-transparent rounded-full blur-2xl animate-pulse" style={{ animationDelay: '2s' }} />
        <div className="absolute bottom-1/4 left-1/4 w-[300px] h-[250px] bg-gradient-to-tr from-emerald-400/20 via-teal-300/10 to-transparent rounded-full blur-2xl animate-pulse" style={{ animationDelay: '0.5s' }} />
      </div>
      <div className="relative z-10 w-full max-w-5xl mx-auto glassy-card p-8 border border-white/10 shadow-2xl backdrop-blur-xl rounded-3xl">
        <h1 className="text-3xl md:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-purple-200 to-blue-200 mb-2 text-center tracking-tight">Private Trading</h1>
        <p className="text-slate-400 mb-8 text-base font-medium text-center">Trade privately with encrypted order batching and zk settlement.</p>
        <div className="flex flex-col md:flex-row gap-8 mb-8">
          <div className="flex-1 flex flex-col gap-6">
            <div className="bg-white/10 border border-white/10 rounded-2xl px-6 py-4 shadow-xl backdrop-blur-xl">
              <h2 className="text-xl font-semibold text-white flex items-center gap-2 mb-1">
                🕶️ Incognito Mode
                <span className="text-sm font-normal text-slate-400">Private Trading Enabled</span>
              </h2>
              <p className="text-sm text-slate-400 mb-3">Your trade details and wallet address will remain hidden on-chain.</p>
              <div className="flex items-center gap-3">
                <input type="number" min="0" step="0.01" value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)}
                  placeholder="Deposit USDC" className="w-32 px-3 py-2 border border-white/10 rounded-lg text-white text-sm bg-slate-900/80 backdrop-blur-md focus:ring-2 focus:ring-purple-500/40" />
                <button onClick={handleDeposit} className="px-4 py-2 font-bold rounded-xl bg-gradient-to-r from-purple-500 via-pink-500 to-blue-500 text-white shadow-lg hover:scale-105 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-purple-400/40 text-sm">Deposit</button>
                <div className="text-white text-sm">
                  {balanceLoading ? 'Loading...' : userBalance ? `Available: ${(Number(userBalance.available) / 1e6).toFixed(2)} USDC` : 'Failed to load balance'}
                </div>
              </div>
            </div>
            <div className="bg-white/10 border border-white/10 rounded-2xl p-4 shadow-xl backdrop-blur-xl">
              <h3 className="text-white text-lg font-semibold mb-3">Your Positions</h3>
              {positionsLoading ? (
                <p className="text-slate-400 text-sm">Loading positions...</p>
              ) : positions.length === 0 ? (
                <p className="text-slate-400 text-sm">No active positions</p>
              ) : (
                positions.map((pos, idx) => (
                  <div key={idx} className="p-3 mb-3 bg-white/5 rounded-lg">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Asset</span>
                      <span className="text-white">{pos.assetId === 0 ? 'TSLA' : 'AAPL'}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Side</span>
                      <span className={`${pos.isLong ? 'text-green-400' : 'text-red-400'}`}>{pos.isLong ? 'Long' : 'Short'}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Size</span>
                      <span className="text-white">{(Number(pos.size) / 1e6).toFixed(2)} USD</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Margin</span>
                      <span className="text-yellow-400">{(Number(pos.margin) / 1e6).toFixed(2)} USDC</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Entry Price</span>
                      <span className="text-white">${(Number(pos.entryPrice) / 1e18).toFixed(2)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
          <div className="flex-1 bg-white/10 border border-white/10 rounded-2xl p-6 shadow-2xl w-full flex flex-col backdrop-blur-xl">
            <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-purple-200 to-blue-200 mb-4 text-center tracking-tight">Private Trade</h2>
            <div className="flex bg-white/5 rounded-lg p-1 mb-4">
              {['long', 'short'].map((d) => (
                <button
                  key={d}
                  onClick={() => setDirection(d)}
                  className={`flex-1 px-4 py-2 text-sm font-bold rounded-md transition-all duration-200 ${
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
              className="w-full mb-4 px-3 py-2 bg-slate-900/80 border border-slate-600 rounded-lg text-white text-sm backdrop-blur-md focus:ring-2 focus:ring-purple-500/40"
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
              className="w-full px-3 py-2 mb-4 border border-white/10 rounded-lg text-white text-sm bg-slate-900/80 backdrop-blur-md focus:ring-2 focus:ring-purple-500/40"
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
            <div className="rounded-lg p-3 space-y-2 bg-white/5 mb-6">
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
              className="w-full py-3 rounded-xl font-bold text-lg bg-gradient-to-r from-purple-500 via-pink-500 to-blue-500 text-white shadow-lg hover:scale-105 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-purple-400/40 mb-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Processing...' : 'Send Private Trade'}
            </button>
            <button
              onClick={handleClosePosition}
              disabled={loading}
              className="w-full py-3 rounded-xl font-bold text-lg bg-gradient-to-r from-purple-500 via-pink-500 to-blue-500 text-white shadow-lg hover:scale-105 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-purple-400/40 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Close Position
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
