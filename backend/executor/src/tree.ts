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
const leafMid: Leaf = { size: BigInt(4), margin: BigInt(120), entryFunding: BigInt(10) };
const leafRight: Leaf = { size: BigInt(4), margin: BigInt(-120), entryFunding: BigInt(10) };

const zeroValue = BigInt(0);

const leftHash = hashLeaf(leafLeft);
const midHash = hashLeaf(leafMid);
const rightHash = hashLeaf(leafRight);

const depth = 10;
const arity = 2;
const leaves = [leftHash, midHash, rightHash];

// Use poseidon2 for the IMT hash function (arity=2)
const tree = new IMT(poseidon2, depth, zeroValue, arity, leaves);

console.log("Tree is", tree);
console.log("Merkle root:", tree.root);

// const proof = tree.createProof(0);
// console.log("Proof valid:", tree.verifyProof(proof));
// console.log(tree.leaves)
// tree.insert(hashLeaf({size: BigInt(5), margin: BigInt(200), entryFunding: BigInt(15)}));
// console.log("New Merkle root after insertion:", tree.root);
// console.log("New Merkle leaves after insertion:", tree);
// tree.delete(2)
// console.log("New Merkle tree after deletion:", tree);

export function currentRoot(){
  return tree.root;
}

export function insertPosition(leaf: Leaf): number{
  tree.insert(hashLeaf(leaf));
  return tree.indexOf(hashLeaf(leaf));
}

export function deletePosition(hash: bigint){
  const index= tree.indexOf(hash)
  tree.delete(index)
}
// deletePosition(15215956860192754867003942406872706015577979927073229954434143459039467021244n)
// console.log(tree)

// const proof = tree.createProof(0)
// console.log("Proof:", proof);

export function getPathIndices(index: number): number[] {
  const proof = tree.createProof(index);
  return proof.pathIndices;
}

export function getPathElements(index: number): bigint[] {
  const proof = tree.createProof(index);
  const elements= proof.siblings
  let pathElements: bigint[] = [];
  for (let i = 0; i < elements.length; i++) {
    pathElements.push(elements[i].toString());
}
  return pathElements;
}

const elements =getPathElements(0)
console.log("Path Elements:", elements);
const indices =getPathIndices(0)
console.log("Path Indices:", indices);
