
import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { groth16 } from "snarkjs";

// Absolute paths to your artifacts
const wasmFile = path.resolve(
  process.cwd(),
  "../backend/circuits-synth/outputs/liquidate_js/liquidate.wasm"
);
const zkeyFile = path.resolve(
  process.cwd(),
  "../backend/circuits-synth/outputs/liquidate_final.zkey"
);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const input = {
      oldRoot:      body.oldRoot,
      newRoot:      body.newRoot,
      size:         body.size,
      margin:       body.margin,
      entryFunding: body.entryFunding,
      cumFunding:   body.cumFunding,
      pathElements: body.pathElements,
      pathIndices:  body.pathIndices,
    };

    const { proof, publicSignals } = await groth16.fullProve(
      input,
      wasmFile,
      zkeyFile
    );

    return NextResponse.json({ proof, publicSignals });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || String(err) },
      { status: 500 }
    );
  }
}
