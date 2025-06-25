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
var promises_1 = require("fs/promises");
var tree_1 = require("./tree");
function generateAndVerifyProof() {
    return __awaiter(this, void 0, void 0, function () {
        var fieldModulus, merkleRoot, input, baseDir, wasmPath, zkeyPath, vkeyPath, _a, proof, publicSignals, vkeyData, verificationKey, verifyResult, error_1;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    fieldModulus = BigInt("21888242871839275222246405745257275088548364400416034343698204186575808495617");
                    merkleRoot = BigInt((0, tree_1.currentRoot)());
                    console.log("Current Merkle Root:", merkleRoot.toString());
                    input = {
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
                        pathIndices: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
                    };
                    baseDir = (0, path_1.resolve)(__dirname, "../../circuits-synth/outputs");
                    wasmPath = (0, path_1.resolve)(baseDir, "liquidate_js/liquidate.wasm");
                    zkeyPath = (0, path_1.resolve)(baseDir, "liquidate_final.zkey");
                    vkeyPath = (0, path_1.resolve)(baseDir, "verification_key.json");
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 5, , 6]);
                    return [4 /*yield*/, (0, groth16_1.prove)(input, wasmPath, zkeyPath)];
                case 2:
                    _a = _b.sent(), proof = _a.proof, publicSignals = _a.publicSignals;
                    console.log("Generated Proof:", JSON.stringify(proof, null, 2));
                    console.log("Public Signals:", publicSignals);
                    return [4 /*yield*/, (0, promises_1.readFile)(vkeyPath, "utf-8")];
                case 3:
                    vkeyData = _b.sent();
                    verificationKey = JSON.parse(vkeyData);
                    return [4 /*yield*/, (0, groth16_1.verify)(verificationKey, {
                            proof: proof,
                            publicSignals: publicSignals
                        })];
                case 4:
                    verifyResult = _b.sent();
                    console.log("Verification Result:", verifyResult);
                    return [2 /*return*/, verifyResult];
                case 5:
                    error_1 = _b.sent();
                    console.error("Proof operation failed:", error_1 instanceof Error ? error_1.message : error_1);
                    process.exit(1);
                    return [3 /*break*/, 6];
                case 6: return [2 /*return*/];
            }
        });
    });
}
generateAndVerifyProof();
