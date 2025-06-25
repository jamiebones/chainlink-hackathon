"use strict";
// import { poseidon } from 'circomlibjs';
// import { IncrementalMerkleTree } from "@zk-kit/incremental-merkle-tree";
Object.defineProperty(exports, "__esModule", { value: true });
// export interface Leaf {
//   size:         bigint; // signed 1e18
//   margin:       bigint; // USDC 1e6
//   entryFunding: bigint; // 1e18
// }
// /* leaf hash */
// export function hashLeaf(l: Leaf): bigint {
//   return poseidon([l.size, l.margin, l.entryFunding]);
// }
// export const tree = new IncrementalMerkleTree(poseidon, 20, 0n, 2);
// /* deterministic key → index mapping */
// export function keyToIndex(key: string): number {
//   // keccak256(key) mod 2^20
//   const hash = BigInt(`0x${Buffer.from(key).toString('hex')}`);
//   return Number(hash & ((1n << 20n) - 1n));
// }
// export function upsert(key: string, leaf: Leaf) {
//   const idx = keyToIndex(key);
//   tree.update(idx, hashLeaf(leaf));
// }
// export function currentRoot(): bigint {
//   return tree.root;
// }
// import { IMT } from "@zk-kit/imt"
// import { poseidon2 } from "poseidon-lite"
// /**
//  * depth: number of nodes from the leaf to the tree's root node.
//  * zeroValue: default zero, can vary based on the specific use-case.
//  * arity: number of children per node (2 = Binary IMT, 5 = Quinary IMT).
//  */
// const depth = 16
// const zeroValue = 0
// const arity = 2
// /**
//  * To create an instance of an IMT, you need to provide the hash function
//  * used to compute the tree nodes, as well as the depth, zeroValue, and arity of the tree.
//  */
// const tree = new IMT(poseidon2, depth, zeroValue, arity)
// // You can also initialize a tree with a given list of leaves.
// // const leaves = [1, 2, 3]
// // new IMT(poseidon2, depth, zeroValue, arity, leaves)
// // Insert (incrementally) a leaf with a value of 1.
// tree.insert(1)
// // Insert (incrementally) a leaf with a value of 3.
// tree.insert(3)
// // 6176938709541216276071057251289703345736952331798983957780950682673395007393n.
// console.log(tree.root)
// /*
// [
//   0,
//   14744269619966411208579211824598458697587494354926760081771325075741142829156n,
//   7423237065226347324353380772367382631490014989348495481811164164159255474657n,
//   11286972368698509976183087595462810875513684078608517520839298933882497716792n,
//   3607627140608796879659380071776844901612302623152076817094415224584923813162n,
//   19712377064642672829441595136074946683621277828620209496774504837737984048981n,
//   20775607673010627194014556968476266066927294572720319469184847051418138353016n,
//   3396914609616007258851405644437304192397291162432396347162513310381425243293n,
//   21551820661461729022865262380882070649935529853313286572328683688269863701601n,
//   6573136701248752079028194407151022595060682063033565181951145966236778420039n,
//   12413880268183407374852357075976609371175688755676981206018884971008854919922n,
//   14271763308400718165336499097156975241954733520325982997864342600795471836726n,
//   20066985985293572387227381049700832219069292839614107140851619262827735677018n,
//   9394776414966240069580838672673694685292165040808226440647796406499139370960n,
//   11331146992410411304059858900317123658895005918277453009197229807340014528524n,
//   15819538789928229930262697811477882737253464456578333862691129291651619515538n
// ]
// */
// console.log(tree.zeroes)
// // 2
// console.log(tree.arity)
// // 16
// console.log(tree.depth)
// // [1, 3]
// console.log(tree.leaves)
// // Get the index of the leaf with value 3.
// const idx = tree.indexOf(3)
// // 1
// console.log(idx)
// // Update the value of the leaf at position 1 to 2.
// tree.update(1, 2)
// // [1, 2]
// console.log(tree.leaves)
// // Delete leaf at position 1.
// tree.delete(1)
// // [1, 0]
// console.log(tree.leaves)
// /**
//  * Compute a Merkle Inclusion Proof (proof of membership) for the leaf with index 1.
//  * The proof is only valid if the value 1 is found in a leaf of the tree.
//  */
// const proof = tree.createProof(1)
// // true
// console.log(tree.verifyProof(proof))
var imt_1 = require("@zk-kit/imt");
var poseidon_lite_1 = require("poseidon-lite");
// Use poseidon3 for leaf hash (3 fields)
function hashLeaf(l) {
    return (0, poseidon_lite_1.poseidon3)([l.size, l.margin, l.entryFunding]);
}
var leafLeft = { size: BigInt(3), margin: BigInt(-100), entryFunding: BigInt(5) };
var leafRight = { size: BigInt(4), margin: BigInt(120), entryFunding: BigInt(10) };
var zeroValue = BigInt(0);
var leftHash = hashLeaf(leafLeft);
var rightHash = hashLeaf(leafRight);
var depth = 1;
var arity = 2;
var leaves = [leftHash, rightHash];
// Use poseidon2 for the IMT hash function (arity=2)
var tree = new imt_1.IMT(poseidon_lite_1.poseidon2, depth, zeroValue, arity, leaves);
console.log("Leaf hashes:", leaves);
console.log("Merkle root:", tree.root);
var proof = tree.createProof(0);
console.log("Proof valid:", tree.verifyProof(proof));
// const idx = tree.indexOf(BigInt(1707644369138053022538835966562073485769438133463321029850572729311537010102));
// console.log(idx)
console.log(tree.leaves);
