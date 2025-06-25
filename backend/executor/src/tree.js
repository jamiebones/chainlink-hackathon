"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hashLeaf = hashLeaf;
exports.currentRoot = currentRoot;
exports.insertPosition = insertPosition;
exports.deletePosition = deletePosition;
var imt_1 = require("@zk-kit/imt");
var poseidon_lite_1 = require("poseidon-lite");
// Use poseidon3 for leaf hash (3 fields)
function hashLeaf(l) {
    return (0, poseidon_lite_1.poseidon3)([l.size, l.margin, l.entryFunding]);
}
var leafLeft = { size: BigInt(3), margin: BigInt(-100), entryFunding: BigInt(5) };
var leafMid = { size: BigInt(4), margin: BigInt(120), entryFunding: BigInt(10) };
var leafRight = { size: BigInt(4), margin: BigInt(-120), entryFunding: BigInt(10) };
var zeroValue = BigInt(0);
var leftHash = hashLeaf(leafLeft);
var midHash = hashLeaf(leafMid);
var rightHash = hashLeaf(leafRight);
var depth = 10;
var arity = 2;
var leaves = [leftHash, midHash, rightHash];
// Use poseidon2 for the IMT hash function (arity=2)
var tree = new imt_1.IMT(poseidon_lite_1.poseidon2, depth, zeroValue, arity, leaves);
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
function currentRoot() {
    return tree.root;
}
function insertPosition(leaf) {
    tree.insert(hashLeaf(leaf));
    return tree.indexOf(hashLeaf(leaf));
}
function deletePosition(hash) {
    var index = tree.indexOf(hash);
    tree.delete(index);
}
// deletePosition(15215956860192754867003942406872706015577979927073229954434143459039467021244n)
// console.log(tree)
