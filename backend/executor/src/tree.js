"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tree = void 0;
exports.hashLeaf = hashLeaf;
exports.keyToIndex = keyToIndex;
exports.upsert = upsert;
exports.currentRoot = currentRoot;
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
var circomlibjs_1 = require("circomlibjs");
var incremental_merkle_tree_1 = require("@zk-kit/incremental-merkle-tree");
/* leaf hash */
function hashLeaf(l) {
    return (0, circomlibjs_1.poseidon)([l.size, l.margin, l.entryFunding]);
}
exports.tree = new incremental_merkle_tree_1.IncrementalMerkleTree(circomlibjs_1.poseidon, 20, 0n, 2);
/* deterministic key → index mapping */
function keyToIndex(key) {
    // keccak256(key) mod 2^20
    var hash = BigInt("0x".concat(Buffer.from(key).toString('hex')));
    return Number(hash & ((1n << 20n) - 1n));
}
function upsert(key, leaf) {
    var idx = keyToIndex(key);
    exports.tree.update(idx, hashLeaf(leaf));
}
function currentRoot() {
    return exports.tree.root;
}
