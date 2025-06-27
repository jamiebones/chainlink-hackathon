// import {recomputeRoot, Leaf } from './tree.js'; 
// import { proveAndLiquidate } from './proof.js'; 
// import { receiver } from './contracts.js'; 
// import { getPrice } from './oracle.js'; 
// export interface Trade { 
// trader: string; 
// assetId: number; 
// qty:    bigint; 
// margin: bigint; 
// } 
// const leaves  = new Map<string, Leaf>(); 
// const nets: Record<number, { qty: bigint; margin: bigint }> = {}; 
// let   flushTimer: NodeJS.Timeout | null = null; 
// const FLUSH_MS = 5000; 
 
// export async function addTradeToBatch(t: Trade) { 
//   const key = `${t.trader}-${t.assetId}`; 
//   const leaf = leaves.get(key) ?? { size: 0n, margin: 0n, entryFunding: 0n }; 
//   leaf.size   += t.qty; 
//   leaf.margin += t.margin; 
//   leaves.set(key, leaf); 
 
//   const n = nets[t.assetId] || { qty: 0n, margin: 0n }; 
//   n.qty    += t.qty; 
//   n.margin += t.margin; 
//   nets[t.assetId] = n; 
 
//   if (!flushTimer) flushTimer = setTimeout(flushBatch, FLUSH_MS); 
// } 
 
// async function flushBatch() { 
//   flushTimer = null; 
//   const root = recomputeRoot(leaves); 
 
//   // quick liquidation check (placeholder) 
//   for (const key of leaves.keys()) { 
//     const [trader, assetId] = key.split('-'); 
//     await proveAndLiquidate(trader, Number(assetId), await getPrice(Number(assetId)), root); 
//   } 
 
//   // send net exposure 
//   for (const [idStr, agg] of Object.entries(nets)) { 
//     if (agg.qty !== 0n || agg.margin !== 0n) { 
//       await receiver.tradeNet(Number(idStr), agg.qty, agg.margin, { gasLimit: 300_000 }); 
//       nets[Number(idStr)] = { qty: 0n, margin: 0n }; 
//     } 
//   } 
// }

import { upsert, currentRoot, Leaf } from './tree'
import { proveAndLiquidate } from './proof.js';
import { getPrice } from './oracle';
import { ethers } from 'ethers';
import PerpZKABI from './abis/PerpEngineZK.json';

const provider = new ethers.JsonRpcProvider("http://localhost:8545"); // or your RPC
const signer = provider.getSigner(); // or some wallet
const perpZK = new ethers.Contract("0xYOUR_CONTRACT_ADDRESS", PerpZKABI, signer);


export interface Trade {
  trader: string;
  assetId: number;
  qty:    bigint;
  margin: bigint;   // signed
}

const leaves  = new Map<string, Leaf>();
const nets: Record<number, { qty: bigint; margin: bigint }> = {};
let   flushTimer: NodeJS.Timeout | null = null;
const FLUSH_MS = 5000;

/* add trade */
export async function addTradeToBatch(t: Trade) {
  const key = `${t.trader}-${t.assetId}`;
  const leaf = leaves.get(key) ?? { size: 0n, margin: 0n, entryFunding: 0n };

  leaf.size   += t.qty;
  leaf.margin += t.margin;
  leaves.set(key, leaf);

  upsert(key, leaf);                           // ◀ O(log n)

  const n = nets[t.assetId] || { qty: 0n, margin: 0n };
  n.qty    += t.qty;
  n.margin += t.margin;
  nets[t.assetId] = n;

  if (!flushTimer) flushTimer = setTimeout(flushBatch, FLUSH_MS);
}

/* flush */
async function flushBatch() {
  flushTimer = null;
  const root = currentRoot();

  for (const [key, leaf] of leaves) {
    const [trader, assetIdStr] = key.split('-');
    const assetId = Number(assetIdStr);

    // TODO: quick MCR check before proving
    await proveAndLiquidate(trader, assetId, await getPrice(assetId), root, leaf);
  }

  for (const [idStr, agg] of Object.entries(nets)) {
    if (agg.qty !== 0n || agg.margin !== 0n) {
      await perpZK.tradeNet(
  Number(idStr),
  agg.qty,
  agg.margin,
  { gasLimit: 300_000 }
);

      nets[Number(idStr)] = { qty: 0n, margin: 0n };
    }
  }
}

