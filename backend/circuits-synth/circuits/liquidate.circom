pragma circom 2.1.7;
include "poseidon.circom";
include "comparators.circom";
include "mux1.circom";

// MERKLE INCLUSION FOR DEPTH-1 TREE (2 LEAVES)
template MerkleInclusion1() {
    signal input leaf;
    signal input pathElements[1];  // Only 1 sibling needed
    signal input pathIndices[1];   // Only 1 index selector
    signal input root;
    signal output outRoot;

    component h = Poseidon(2);
    component leftMux = Mux1();
    component rightMux = Mux1();

    // Select left input: leaf or sibling based on index
    leftMux.c[0] <== leaf;
    leftMux.c[1] <== pathElements[0];
    leftMux.s <== pathIndices[0];
    
    // Select right input: sibling or leaf based on index
    rightMux.c[0] <== pathElements[0];
    rightMux.c[1] <== leaf;
    rightMux.s <== pathIndices[0];

    h.inputs[0] <== leftMux.out;
    h.inputs[1] <== rightMux.out;
    
    outRoot <== h.out;
    outRoot === root; // Verify computed root matches input
}

template Liquidate3() {
    // Public inputs
    signal input oldRoot;
    signal input newRoot;
    signal input size;
    signal input margin;
    signal input entryFunding;
    signal input cumFunding;
    signal output isLiquidated;
    // Private path (now depth-1)
    signal input pathElements[1];  // Reduced to 1 element
    signal input pathIndices[1];   // Reduced to 1 index

    // Compute leaf hash
    component leafH = Poseidon(3);
    leafH.inputs[0] <== size;
    leafH.inputs[1] <== margin;
    leafH.inputs[2] <== entryFunding;

    // Merkle inclusion proof (depth-1)
    component merkle = MerkleInclusion1();
    merkle.leaf <== leafH.out;
    merkle.root <== oldRoot;
    merkle.pathElements[0] <== pathElements[0];
    merkle.pathIndices[0] <== pathIndices[0];
    log("The Root hash calculated by circuit is: ", merkle.outRoot);
    merkle.outRoot === oldRoot; 

    signal pnl; 
    pnl <== (cumFunding - entryFunding) * size;
    signal adjMargin; 
    adjMargin <== margin + pnl;
    log("The adjusted margin is: ", adjMargin);

    component lt = LessThan(64);
    lt.in[0] <== adjMargin;
    lt.in[1] <== 0;
    isLiquidated <== lt.out ; // Require adjMargin < 0
    newRoot === oldRoot; 
}

component main = Liquidate3();
