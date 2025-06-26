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
import { getPathElements,getPathIndices } from "./tree";
async function generateAndVerifyProof(index: number ) {
  // Field modulus conversion
  const fieldModulus = BigInt("21888242871839275222246405745257275088548364400416034343698204186575808495617");
  const merkleRoot: bigint= BigInt(currentRoot())
  console.log("Current Merkle Root:", merkleRoot.toString());
  const input = {
    oldRoot: merkleRoot.toString(),  
    newRoot: merkleRoot.toString(),  
    size: 3,
    margin: (BigInt(-100) + fieldModulus).toString(),
    entryFunding: 5,
    cumFunding: 0,  
    pathElements: getPathElements(index),
  pathIndices: getPathIndices(index) 
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
    // const vkeyData = await readFile(vkeyPath, "utf-8");
    // const verificationKey: Groth16VerificationKey = JSON.parse(vkeyData);
    
    // // 3. Verify proof with correct structure
    // const verifyResult = await verify(verificationKey, {
    //   proof,
    //   publicSignals
    // });
    
    // console.log("Verification Result:", verifyResult);
    // return verifyResult;
    
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

generateAndVerifyProof(0);
