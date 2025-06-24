// import { groth16 }  from 'snarkjs';
// import { readFileSync } from 'fs';
// import path from 'path';
// import { perpZK } from './contracts.js';
// import { Leaf }   from './tree.js';

// const wasmPath = path.resolve('circuits/build/liquidate_js/liquidate.wasm');
// const zkeyPath = path.resolve('circuits/build/circuit_0000.zkey');

// export async function proveAndLiquidate(
//   trader: string,
//   assetId: number,
//   price: bigint,      // ◀ future use
//   root:  bigint,
//   leaf:  Leaf
// ) {
//   const input: any = {
//     oldRoot:      root.toString(),
//     newRoot:      root.toString(),   // MVP: no deletion
//     size:         leaf.size.toString(),
//     margin:       leaf.margin.toString(),
//     entryFunding: leaf.entryFunding.toString(),
//     cumFunding:   '0',
//     pathElements: Array(20).fill('0'),
//     pathIndices:  Array(20).fill('0')
//   };

//   const { proof, publicSignals } = await groth16.fullProve(
//     input,
//     wasmPath,
//     zkeyPath
//   );

//   await perpZK.verifyAndLiquidate(
//     assetId,
//     publicSignals[0],
//     publicSignals[1],
//     trader,
//     leaf.size,
//     leaf.margin,
//     leaf.entryFunding,
//     proof,
//     { gasLimit: 600_000 }
//   );
// }

// proof.ts

import { prove } from "@zk-kit/groth16";
import { resolve } from "path";

async function generateProof() {
  // Hardcoded input values
  const input = {
  "oldRoot": "8068729852621700367328332468602027432536331799177594994194018856225085146677",
  "newRoot": "8068729852621700367328332468602027432536331799177594994194018856225085146677",
  "size": "3",         
  "margin": "-100",
  "entryFunding": "5",
  "cumFunding": "0",
  "pathElements": [
    "15215956860192754867003942406872706015577979927073229954434143459039467021244"
  ],
  "pathIndices": ["0"]
}

  // Resolve circuit paths (adjust based on your project structure)
  const wasmPath = resolve(__dirname, "../../circuits-synth/outputs/liquidate_js/liquidate.wasm");
  const zkeyPath = resolve(__dirname, "../../circuits-synth/outputs/liquidate_final.zkey");

  try {
    const { proof, publicSignals } = await prove(input, wasmPath,zkeyPath);
    
    console.log(JSON.stringify({
      proof: {
        pi_a: proof.pi_a,
        pi_b: proof.pi_b,
        pi_c: proof.pi_c,
        protocol: proof.protocol,
        curve: proof.curve
      },
      publicSignals
    }, null, 2));
  } catch (error) {
    console.error("Proof generation failed:", error);
    process.exit(1);
  }
}

generateProof();
