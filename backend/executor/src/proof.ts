import { groth16 }  from 'snarkjs';
import { readFileSync } from 'fs';
import path from 'path';
import { perpZK } from './contracts.js';
import { Leaf }   from './tree.js';

const wasmPath = path.resolve('circuits/build/liquidate_js/liquidate.wasm');
const zkeyPath = path.resolve('circuits/build/circuit_0000.zkey');

export async function proveAndLiquidate(
  trader: string,
  assetId: number,
  price: bigint,      // ◀ future use
  root:  bigint,
  leaf:  Leaf
) {
  const input: any = {
    oldRoot:      root.toString(),
    newRoot:      root.toString(),   // MVP: no deletion
    size:         leaf.size.toString(),
    margin:       leaf.margin.toString(),
    entryFunding: leaf.entryFunding.toString(),
    cumFunding:   '0',
    pathElements: Array(20).fill('0'),
    pathIndices:  Array(20).fill('0')
  };

  const { proof, publicSignals } = await groth16.fullProve(
    input,
    wasmPath,
    zkeyPath
  );

  await perpZK.verifyAndLiquidate(
    assetId,
    publicSignals[0],
    publicSignals[1],
    trader,
    leaf.size,
    leaf.margin,
    leaf.entryFunding,
    proof,
    { gasLimit: 600_000 }
  );
}

