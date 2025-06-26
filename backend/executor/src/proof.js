"use strict";
// import { prove, verify } from "@zk-kit/groth16";
// import { resolve } from "path";
// import { getPathElements, getPathIndices, currentRoot } from "./tree";
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
var groth16_1 = require("@zk-kit/groth16");
var path_1 = require("path");
var tree_1 = require("./tree");
function formatProofForSolidity(proof, publicSignals) {
    var a = [proof.pi_a[0].toString(), proof.pi_a[1].toString()];
    var b = [
        [proof.pi_b[0][1].toString(), proof.pi_b[0][0].toString()],
        [proof.pi_b[1][1].toString(), proof.pi_b[1][0].toString()]
    ];
    var c = [proof.pi_c[0].toString(), proof.pi_c[1].toString()];
    var input = publicSignals.map(function (x) { return x.toString(); });
    return { a: a, b: b, c: c, input: input };
}
function generateAndVerifyProof(index) {
    return __awaiter(this, void 0, void 0, function () {
        var fieldModulus, merkleRoot, input, baseDir, wasmPath, zkeyPath, _a, proof, publicSignals, _b, a, b, c, inputArr, error_1;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    fieldModulus = BigInt("21888242871839275222246405745257275088548364400416034343698204186575808495617");
                    merkleRoot = BigInt((0, tree_1.currentRoot)());
                    input = {
                        oldRoot: merkleRoot.toString(),
                        newRoot: merkleRoot.toString(),
                        size: 3,
                        margin: (BigInt(-100) + fieldModulus).toString(),
                        entryFunding: 5,
                        cumFunding: 0,
                        pathElements: (0, tree_1.getPathElements)(index),
                        pathIndices: (0, tree_1.getPathIndices)(index)
                    };
                    baseDir = (0, path_1.resolve)(__dirname, "../../circuits-synth/outputs");
                    wasmPath = (0, path_1.resolve)(baseDir, "liquidate_js/liquidate.wasm");
                    zkeyPath = (0, path_1.resolve)(baseDir, "liquidate_final.zkey");
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, (0, groth16_1.prove)(input, wasmPath, zkeyPath)];
                case 2:
                    _a = _c.sent(), proof = _a.proof, publicSignals = _a.publicSignals;
                    _b = formatProofForSolidity(proof, publicSignals), a = _b.a, b = _b.b, c = _b.c, inputArr = _b.input;
                    console.log("a is", a);
                    console.log("b is", b);
                    console.log("c is", c);
                    console.log("input is", inputArr);
                    return [3 /*break*/, 4];
                case 3:
                    error_1 = _c.sent();
                    console.error("Proof operation failed:", error_1 instanceof Error ? error_1.message : error_1);
                    process.exit(1);
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    });
}
generateAndVerifyProof(0);
