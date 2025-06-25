import { IMT } from "@zk-kit/imt";
import { poseidon2, poseidon3 } from "poseidon-lite";

export interface Leaf {
  size: bigint;
  margin: bigint;
  entryFunding: bigint;
}

// Use poseidon3 for leaf hash (3 fields)
export function hashLeaf(l: Leaf): bigint {
  return poseidon3([l.size, l.margin, l.entryFunding]);
}


const leafLeft: Leaf = { size: BigInt(3), margin: BigInt(-100), entryFunding: BigInt(5) };
const leafRight: Leaf = { size: BigInt(4), margin: BigInt(120), entryFunding: BigInt(10) };
const zeroValue = BigInt(0);

const leftHash = hashLeaf(leafLeft);
const rightHash = hashLeaf(leafRight);

const depth = 1;
const arity = 2;
const leaves = [leftHash, rightHash];

// Use poseidon2 for the IMT hash function (arity=2)
const tree = new IMT(poseidon2, depth, zeroValue, arity, leaves);

console.log("Leaf hashes:", leaves);
console.log("Merkle root:", tree.root);

const proof = tree.createProof(0);
console.log("Proof valid:", tree.verifyProof(proof));
// const idx = tree.indexOf(BigInt(1707644369138053022538835966562073485769438133463321029850572729311537010102));
// console.log(idx)
console.log(tree.leaves)

export function currentRoot(){
  return tree.root;
}
