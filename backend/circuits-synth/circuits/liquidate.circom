pragma circom 2.1.7;
include "poseidon.circom";
include "comparators.circom";
include "mux1.circom";

template MerkleInclusion10() {
    signal input leaf;
    signal input pathElements[10];
    signal input pathIndices[10];
    signal input root;
    signal output outRoot;

    signal cur[11];
    cur[0] <== leaf;

    component h[10];
    component leftMux[10];
    component rightMux[10];

    for (var i = 0; i < 10; i++) {
        h[i] = Poseidon(2);
        leftMux[i] = Mux1();
        rightMux[i] = Mux1();

        leftMux[i].c[0] <== cur[i];
        leftMux[i].c[1] <== pathElements[i];
        leftMux[i].s <== pathIndices[i];

        rightMux[i].c[0] <== pathElements[i];
        rightMux[i].c[1] <== cur[i];
        rightMux[i].s <== pathIndices[i];

        h[i].inputs[0] <== leftMux[i].out;
        h[i].inputs[1] <== rightMux[i].out;
        cur[i+1] <== h[i].out;
    }

    outRoot <== cur[10];
    outRoot === root;
}

// Your Liquidate circuit (example)
template Liquidate10() {
    signal input oldRoot;
    signal input newRoot;
    signal input size;
    signal input margin;
    signal input entryFunding;
    signal input cumFunding;
    signal output isLiquidated;

    signal input pathElements[10];
    signal input pathIndices[10];

    component leafH = Poseidon(3);
    leafH.inputs[0] <== size;
    leafH.inputs[1] <== margin;
    leafH.inputs[2] <== entryFunding;

    component merkle = MerkleInclusion10();
    merkle.leaf <== leafH.out;
    merkle.root <== oldRoot;
    for (var i = 0; i < 10; i++) {
        merkle.pathElements[i] <== pathElements[i];
        merkle.pathIndices[i] <== pathIndices[i];
    }
    merkle.outRoot === oldRoot;

    signal pnl;
    pnl <== (cumFunding - entryFunding) * size;
    signal adjMargin;
    adjMargin <== margin + pnl;

    component lt = LessThan(64);
    lt.in[0] <== adjMargin;
    lt.in[1] <== 0;
    isLiquidated <== lt.out;
    newRoot === oldRoot;
}

component main = Liquidate10();
