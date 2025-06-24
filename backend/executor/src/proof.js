"use strict";
// import { groth16 }  from 'snarkjs';
// import { readFileSync } from 'fs';
// import path from 'path';
// import { perpZK } from './contracts.js';
// import { Leaf }   from './tree.js';
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
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
var groth16_1 = require("@zk-kit/groth16");
var path_1 = require("path");
function generateProof() {
    return __awaiter(this, void 0, void 0, function () {
        var input, wasmPath, zkeyPath, _a, proof, publicSignals, error_1;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    input = {
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
                    };
                    wasmPath = (0, path_1.resolve)(__dirname, "../../circuits-synth/outputs/liquidate_js/liquidate.wasm");
                    zkeyPath = (0, path_1.resolve)(__dirname, "../../circuits-synth/outputs/liquidate_final.zkey");
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, (0, groth16_1.prove)(input, wasmPath, zkeyPath)];
                case 2:
                    _a = _b.sent(), proof = _a.proof, publicSignals = _a.publicSignals;
                    console.log(JSON.stringify({
                        proof: {
                            pi_a: proof.pi_a,
                            pi_b: proof.pi_b,
                            pi_c: proof.pi_c,
                            protocol: proof.protocol,
                            curve: proof.curve
                        },
                        publicSignals: publicSignals
                    }, null, 2));
                    return [3 /*break*/, 4];
                case 3:
                    error_1 = _b.sent();
                    console.error("Proof generation failed:", error_1);
                    process.exit(1);
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    });
}
generateProof();
