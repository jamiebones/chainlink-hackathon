// import { prove, verify } from "@zk-kit/groth16";
// import { resolve } from "path";
// import { getPathElements, getPathIndices, currentRoot } from "./tree";


// function formatProofForSolidity(proof: any, publicSignals: string[] | number[]) {
//   const a = [proof.pi_a[0].toString(), proof.pi_a[1].toString()];
//   const b = [
//     [proof.pi_b[0][1].toString(), proof.pi_b[0][0].toString()],
//     [proof.pi_b[1][1].toString(), proof.pi_b[1][0].toString()]
//   ];
//   const c = [proof.pi_c[0].toString(), proof.pi_c[1].toString()];
//   const input = publicSignals.map(x => x.toString());

//   console.log("----- Solidity inputs for verifier (decimal) -----\n");
//   console.log("a:", JSON.stringify(a));
//   console.log("b:", JSON.stringify(b));
//   console.log("c:", JSON.stringify(c));
//   console.log("input:", JSON.stringify(input));
  
//   // Also log as hex for convenience
//   const toHex = (x: string) => '0x' + BigInt(x).toString(16);
//   console.log("----- inputs in hex format -----\n");
//   console.log("a:", JSON.stringify(a.map(toHex)));
//   console.log("b:", JSON.stringify(b.map(pair => pair.map(toHex))));
//   console.log("c:", JSON.stringify(c.map(toHex)));
//   console.log("input:", JSON.stringify(input.map(toHex)));
//   console.log("\n-----------------------------------------------\n");

//   return { a, b, c, input };
// }

// async function generateAndVerifyProof(index: number) {
//   const fieldModulus = BigInt("21888242871839275222246405745257275088548364400416034343698204186575808495617");
//   const merkleRoot: bigint = BigInt(currentRoot());
//   const input = {
//     oldRoot: merkleRoot.toString(),
//     newRoot: merkleRoot.toString(),
//     size: 3,
//     margin: (BigInt(-100) + fieldModulus).toString(),
//     entryFunding: 5,
//     cumFunding: 0,
//     pathElements: getPathElements(index),
//     pathIndices: getPathIndices(index)
//   };

//   const baseDir = resolve(__dirname, "../../circuits-synth/outputs");
//   const wasmPath = resolve(baseDir, "liquidate_js/liquidate.wasm");
//   const zkeyPath = resolve(baseDir, "liquidate_final.zkey");
//   const vkeyPath = resolve(baseDir, "verification_key.json");

//   try {
//     const { proof, publicSignals } = await prove(input, wasmPath, zkeyPath);
//     const { a, b, c, input: inputArr } = formatProofForSolidity(proof, publicSignals);

//   } catch (error) {
//     console.error("Proof operation failed:", error instanceof Error ? error.message : error);
//     process.exit(1);
//   }
// }

// generateAndVerifyProof(0);

import { prove } from "@zk-kit/groth16";
import { resolve } from "path";
import { getPathElements, getPathIndices, currentRoot } from "./tree";
import { ethers } from "ethers";
import PerpEngineZKAbi from "./abis/PerpEngineZK.json";

function formatProofForSolidity(proof: any, publicSignals: string[] | number[]) {
  const a = [proof.pi_a[0].toString(), proof.pi_a[1].toString()];
  const b = [
    [proof.pi_b[0][1].toString(), proof.pi_b[0][0].toString()],
    [proof.pi_b[1][1].toString(), proof.pi_b[1][0].toString()]
  ];
  const c = [proof.pi_c[0].toString(), proof.pi_c[1].toString()];
  const input = publicSignals.map(x => x.toString());
  return { a, b, c, input };
}

async function generateAndVerifyProof(index: number) {
  const fieldModulus = BigInt("21888242871839275222246405745257275088548364400416034343698204186575808495617");
  const merkleRoot: bigint = BigInt(currentRoot());
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

  const baseDir = resolve(__dirname, "../../circuits-synth/outputs");
  const wasmPath = resolve(baseDir, "liquidate_js/liquidate.wasm");
  const zkeyPath = resolve(baseDir, "liquidate_final.zkey");

  try {
    const { proof, publicSignals } = await prove(input, wasmPath, zkeyPath);
    const { a, b, c, input: inputArr } = formatProofForSolidity(proof, publicSignals);
    console.log("a is", a);
    console.log("b is", b);
    console.log("c is", c);
    console.log("input is", inputArr);
    // // ============= Contract Call =============
    // const fujiRpc = "https://api.avax-test.network/ext/bc/C/rpc";
    // const perpZKAddress = "0xYourPerpEngineZKAddressHere"; // TODO: Update this
    // const privKey = process.env.PRIVATE_KEY || "0xYourFujiTestnetPrivateKey"; 
    // const provider = new ethers.JsonRpcProvider(fujiRpc);
    // const signer = new ethers.Wallet(privKey, provider);
    // const contract = new ethers.Contract(perpZKAddress, PerpEngineZKAbi, signer);

    // const assetId = 0;
    // const trader = "0xYourTraderAddressHere"; // TODO: Update this!
    // const size = input.size;
    // const margin = input.margin;
    // const entryFunding = input.entryFunding;
    // const oldRoot = input.oldRoot;
    // const newRoot = input.newRoot;

    // // Call verifyAndLiquidate
    // const tx = await contract.verifyAndLiquidate(
    //   assetId,
    //   oldRoot,
    //   newRoot,
    //   trader,
    //   size,
    //   margin,
    //   entryFunding,
    //   a,
    //   b,
    //   c,
    //   inputArr
    // );

    // console.log("verifyAndLiquidate tx sent:", tx.hash);
    // await tx.wait();
    // console.log("verifyAndLiquidate tx confirmed!");
  } catch (error) {
    console.error("Proof operation failed:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

generateAndVerifyProof(0);
