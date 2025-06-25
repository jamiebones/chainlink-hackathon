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

import { prove, verify } from "@zk-kit/groth16";
import { resolve } from "path";
import { readFile } from "fs/promises";
import {currentRoot} from './tree'
async function generateAndVerifyProof() {
  // Field modulus conversion
  const fieldModulus = BigInt("21888242871839275222246405745257275088548364400416034343698204186575808495617");
  const merkleRoot: bigint= BigInt(currentRoot())
  console.log("Current Merkle Root:", merkleRoot.toString());
  // Input data with explicit types
  const input = {
    oldRoot: merkleRoot.toString(),  
    newRoot: merkleRoot.toString(),  
    size: 3,
    margin: (BigInt(-100) + fieldModulus).toString(),
    entryFunding: 5,
    cumFunding: 0,  
    pathElements: [
    "15215956860192754867003942406872706015577979927073229954434143459039467021244",
    "10767976081731991724067408705540702443536110808973284358838706009676048757543",
    "7423237065226347324353380772367382631490014989348495481811164164159255474657",
    "11286972368698509976183087595462810875513684078608517520839298933882497716792",
    "3607627140608796879659380071776844901612302623152076817094415224584923813162",
    "19712377064642672829441595136074946683621277828620209496774504837737984048981",
    "20775607673010627194014556968476266066927294572720319469184847051418138353016",
    "3396914609616007258851405644437304192397291162432396347162513310381425243293",
    "21551820661461729022865262380882070649935529853313286572328683688269863701601",
    "6573136701248752079028194407151022595060682063033565181951145966236778420039"
  ],
  pathIndices: [0,0,0,0,0,0,0,0,0,0] 
  };

  // Resolve paths with type safety
  const baseDir = resolve(__dirname, "../../circuits-synth/outputs");
  const wasmPath = resolve(baseDir, "liquidate_js/liquidate.wasm");
  const zkeyPath = resolve(baseDir, "liquidate_final.zkey");
  const vkeyPath = resolve(baseDir, "verification_key.json");

  try {
    // 1. Generate proof
    const { proof, publicSignals } = await prove(input, wasmPath, zkeyPath);
    
    console.log("Generated Proof:", JSON.stringify(proof, null, 2));
    console.log("Public Signals:", publicSignals);

    // 2. Load verification key with proper typing
    const vkeyData = await readFile(vkeyPath, "utf-8");
    const verificationKey: Groth16VerificationKey = JSON.parse(vkeyData);
    
    // 3. Verify proof with correct structure
    const verifyResult = await verify(verificationKey, {
      proof,
      publicSignals
    });
    
    console.log("Verification Result:", verifyResult);
    return verifyResult;
    
  } catch (error) {
    console.error("Proof operation failed:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Type definitions for verification key
interface Groth16VerificationKey {
  protocol: "groth16";
  curve: "bn128" | "bls12-381";
  nPublic: number;
  vk_alpha_1: [string, string, string];
  vk_beta_2: [[string, string], [string, string], [string, string]];
  vk_gamma_2: [[string, string], [string, string], [string, string]];
  vk_delta_2: [[string, string], [string, string], [string, string]];
  vk_alphabeta_12: unknown; // Not used in verification
  IC: [string, string][];
}

generateAndVerifyProof();
