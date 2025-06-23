
// import { poseidon } from 'circomlibjs'
// export interface Leaf { 
// size:          
// bigint;   // signed 1e18 
// margin:        
// bigint;   // USDC 1e6 
// entryFunding:  bigint;   // 1e18 
// } 
// export function hashLeaf(l: Leaf): bigint { 
// return poseidon([l.size, l.margin, l.entryFunding]); 
// } 
// export function recomputeRoot(map: Map<string, Leaf>): bigint { 
// // naïve O(n) fold: h = poseidon(h, leafHash) 
// let acc = 0n; 
// for (const v of map.values()) acc = poseidon([acc, hashLeaf(v)]); 
// return acc; 
// } 
import { poseidon } from 'circomlibjs';
import { IncrementalMerkleTree } from "@zk-kit/incremental-merkle-tree";

export interface Leaf {
  size:         bigint; // signed 1e18
  margin:       bigint; // USDC 1e6
  entryFunding: bigint; // 1e18
}

/* leaf hash */
export function hashLeaf(l: Leaf): bigint {
  return poseidon([l.size, l.margin, l.entryFunding]);
}
export const tree = new IncrementalMerkleTree(poseidon, 20, 0n, 2);

/* deterministic key → index mapping */
export function keyToIndex(key: string): number {
  // keccak256(key) mod 2^20
  const hash = BigInt(`0x${Buffer.from(key).toString('hex')}`);
  return Number(hash & ((1n << 20n) - 1n));
}

export function upsert(key: string, leaf: Leaf) {
  const idx = keyToIndex(key);
  tree.update(idx, hashLeaf(leaf));
}

export function currentRoot(): bigint {
  return tree.root;
}
