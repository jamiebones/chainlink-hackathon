"use strict";
// FIXED EXECUTOR - SIMPLIFIED FEE HANDLING
// Key changes marked with 🔧
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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.executor = exports.MinimalExecutor = void 0;
var crypto_1 = require("./crypto");
var database_1 = require("./database");
var fees_1 = require("./fees");
var merkle_1 = require("./merkle");
var contracts_1 = require("./contracts");
var MinimalExecutor = /** @class */ (function () {
    function MinimalExecutor() {
        this.pendingTrades = [];
        this.processingBatch = false;
        this.tradeCounter = 0;
        this.batchCounter = 0;
        this.BATCH_SIZE = 5;
        this.BATCH_TIMEOUT = 120000;
        this.batchTimer = null;
        console.log('🚀 Minimal Executor initializing...');
        this.startBatchTimer();
        console.log('✅ Minimal Executor initialized');
        console.log("\u2699\uFE0F Batch size: ".concat(this.BATCH_SIZE, " trades"));
        console.log("\u23F0 Batch timeout: ".concat(this.BATCH_TIMEOUT / 1000, "s"));
    }
    // ====================================================================
    // 🔧 FIXED TRADE PROCESSING - CLEAN FEE HANDLING
    // ====================================================================
    MinimalExecutor.prototype.processEncryptedTrade = function (encryptedData) {
        return __awaiter(this, void 0, void 0, function () {
            var tradeId, decryptedTrade, payload, validationResult, feeResult, success, processedTrade, error_1;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        tradeId = this.generateTradeId();
                        console.log("\n\uD83D\uDD04 Processing encrypted trade: ".concat(tradeId));
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 6, , 7]);
                        return [4 /*yield*/, crypto_1.cryptoManager.processEncryptedTrade(encryptedData)];
                    case 2:
                        decryptedTrade = _a.sent();
                        if (!decryptedTrade.isValid) {
                            return [2 /*return*/, this.createFailedTrade(tradeId, decryptedTrade.error || 'Decryption failed')];
                        }
                        payload = decryptedTrade.payload;
                        return [4 /*yield*/, this.validateTrade(payload)];
                    case 3:
                        validationResult = _a.sent();
                        if (!validationResult.isValid) {
                            return [2 /*return*/, this.createFailedTrade(tradeId, validationResult.errors.join(', '), payload)];
                        }
                        return [4 /*yield*/, this.calculateAndValidateFees(payload)];
                    case 4:
                        feeResult = _a.sent();
                        if (!feeResult.success) {
                            return [2 /*return*/, this.createFailedTrade(tradeId, feeResult.error, payload)];
                        }
                        return [4 /*yield*/, this.processTradeBalanceAndFees(payload, feeResult.fees)];
                    case 5:
                        success = _a.sent();
                        if (!success) {
                            return [2 /*return*/, this.createFailedTrade(tradeId, 'Failed to process balance and fees', payload)];
                        }
                        processedTrade = {
                            tradeId: tradeId,
                            trader: payload.trader,
                            assetId: payload.assetId,
                            qty: BigInt(payload.qty),
                            margin: BigInt(payload.margin),
                            isLong: payload.isLong,
                            timestamp: payload.timestamp,
                            isValid: true,
                            fees: feeResult.fees
                        };
                        // Step 6: Add to pending trades
                        this.pendingTrades.push(processedTrade);
                        console.log("\u2705 Trade ".concat(tradeId, " validated and queued"));
                        console.log("\uD83D\uDCCA ".concat(payload.trader, " ").concat(payload.isLong ? 'LONG' : 'SHORT', " $").concat(Number(BigInt(payload.qty)) / 1e6, " asset ").concat(payload.assetId));
                        console.log("\uD83D\uDCB0 Fees: $".concat(Number(feeResult.fees.totalFees) / 1e6, ", Net margin locked: $").concat(Number(feeResult.fees.netMargin) / 1e6));
                        console.log("\uD83D\uDCCB Pending trades: ".concat(this.pendingTrades.length, "/").concat(this.BATCH_SIZE));
                        // Step 7: Check if we should process batch
                        if (this.pendingTrades.length >= this.BATCH_SIZE) {
                            console.log('🚀 Batch size reached, processing immediately...');
                            setTimeout(function () { return _this.processBatch(); }, 120000);
                        }
                        return [2 /*return*/, processedTrade];
                    case 6:
                        error_1 = _a.sent();
                        console.error("\u274C Trade processing failed for ".concat(tradeId, ":"), error_1);
                        return [2 /*return*/, this.createFailedTrade(tradeId, error_1 instanceof Error ? error_1.message : 'Unknown error')];
                    case 7: return [2 /*return*/];
                }
            });
        });
    };
    // ====================================================================
    // 🔧 NEW CLEAN BALANCE & FEE PROCESSING
    // ====================================================================
    MinimalExecutor.prototype.processTradeBalanceAndFees = function (payload, fees) {
        return __awaiter(this, void 0, void 0, function () {
            var trader, totalMargin, userBalance, feeDeducted, marginLocked, finalBalance;
            return __generator(this, function (_a) {
                trader = payload.trader;
                totalMargin = BigInt(payload.margin);
                try {
                    console.log("\uD83D\uDCB0 Processing balance for ".concat(trader, ":"));
                    console.log("   Total margin required: $".concat(Number(totalMargin) / 1e6));
                    console.log("   Fees to deduct: $".concat(Number(fees.totalFees) / 1e6));
                    console.log("   Net margin to lock: $".concat(Number(fees.netMargin) / 1e6));
                    userBalance = database_1.database.getUserBalance(trader);
                    if (userBalance.available < totalMargin) {
                        console.error("\u274C Insufficient balance: $".concat(Number(userBalance.available) / 1e6, " < $").concat(Number(totalMargin) / 1e6));
                        return [2 /*return*/, false];
                    }
                    feeDeducted = database_1.database.deductFee(trader, fees.totalFees);
                    if (!feeDeducted) {
                        console.error("\u274C Failed to deduct fees");
                        return [2 /*return*/, false];
                    }
                    marginLocked = database_1.database.lockBalance(trader, fees.netMargin);
                    if (!marginLocked) {
                        // Rollback fee deduction
                        console.error("\u274C Failed to lock net margin, rolling back fee deduction");
                        database_1.database.addBalance(trader, fees.totalFees);
                        return [2 /*return*/, false];
                    }
                    finalBalance = database_1.database.getUserBalance(trader);
                    console.log("\u2705 Balance processed successfully:");
                    console.log("   Available: $".concat(Number(finalBalance.available) / 1e6));
                    console.log("   Locked: $".concat(Number(finalBalance.locked) / 1e6));
                    console.log("   Total: $".concat(Number(finalBalance.total) / 1e6));
                    return [2 /*return*/, true];
                }
                catch (error) {
                    console.error("\u274C Balance processing failed for ".concat(trader, ":"), error);
                    return [2 /*return*/, false];
                }
                return [2 /*return*/];
            });
        });
    };
    // ====================================================================
    // 🔧 SIMPLIFIED BATCH PROCESSING - NO MORE FEE COMPLICATIONS
    // ====================================================================
    MinimalExecutor.prototype.processBatch = function () {
        return __awaiter(this, void 0, void 0, function () {
            var batchId, checkpoint, trades, totalFees, assetDeltas, _a, oldRoot, newRoot, txHash, result, error_2, result;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (this.processingBatch || this.pendingTrades.length === 0) {
                            return [2 /*return*/, null];
                        }
                        this.processingBatch = true;
                        batchId = this.generateBatchId();
                        console.log("\n\uD83C\uDFED Processing batch ".concat(batchId, " with ").concat(this.pendingTrades.length, " trades"));
                        checkpoint = merkle_1.merkleTree.createCheckpoint();
                        trades = __spreadArray([], this.pendingTrades, true);
                        this.pendingTrades = [];
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 4, 6, 7]);
                        // 🔧 Step 1: NO MORE FEE DEDUCTION - Already done during individual processing!
                        console.log('💰 Fees already deducted during individual trade processing ✅');
                        totalFees = trades.reduce(function (sum, trade) { var _a; return sum + (((_a = trade.fees) === null || _a === void 0 ? void 0 : _a.totalFees) || 0n); }, 0n);
                        assetDeltas = this.calculateAssetDeltas(trades);
                        return [4 /*yield*/, this.updatePositionsAndMerkleTree(trades)];
                    case 2:
                        _a = _b.sent(), oldRoot = _a.oldRoot, newRoot = _a.newRoot;
                        return [4 /*yield*/, this.submitBatchToContract(assetDeltas, oldRoot, newRoot)];
                    case 3:
                        txHash = _b.sent();
                        // 🔧 Step 5: NO MORE BALANCE UNLOCKING - Net margin already locked correctly!
                        console.log('🔓 No balance unlocking needed - net margins already locked correctly ✅');
                        result = {
                            batchId: batchId,
                            processedTrades: trades.length,
                            assetIds: Array.from(assetDeltas.keys()),
                            netDeltas: Array.from(assetDeltas.values()).map(function (d) { return d.netQtyDelta; }),
                            marginDeltas: Array.from(assetDeltas.values()).map(function (d) { return d.netMarginDelta; }),
                            oldRoot: oldRoot,
                            newRoot: newRoot,
                            txHash: txHash,
                            totalFees: totalFees,
                            success: true,
                            timestamp: Date.now()
                        };
                        console.log("\u2705 Batch ".concat(batchId, " processed successfully: ").concat(txHash));
                        console.log("\uD83D\uDCCA Processed ".concat(trades.length, " trades, collected $").concat(Number(totalFees) / 1e6, " fees"));
                        return [2 /*return*/, result];
                    case 4:
                        error_2 = _b.sent();
                        console.error("\u274C Batch ".concat(batchId, " failed:"), error_2);
                        // 🔧 Rollback changes
                        return [4 /*yield*/, this.rollbackBatch(checkpoint, trades)];
                    case 5:
                        // 🔧 Rollback changes
                        _b.sent();
                        result = {
                            batchId: batchId,
                            processedTrades: 0,
                            assetIds: [],
                            netDeltas: [],
                            marginDeltas: [],
                            oldRoot: checkpoint.root.toString(),
                            newRoot: checkpoint.root.toString(),
                            txHash: '',
                            totalFees: 0n,
                            success: false,
                            error: error_2 instanceof Error ? error_2.message : 'Unknown error',
                            timestamp: Date.now()
                        };
                        return [2 /*return*/, result];
                    case 6:
                        this.processingBatch = false;
                        this.startBatchTimer();
                        return [7 /*endfinally*/];
                    case 7: return [2 /*return*/];
                }
            });
        });
    };
    // ====================================================================
    // 🔧 SIMPLIFIED ROLLBACK - CLEAN BALANCE RESTORATION
    // ====================================================================
    MinimalExecutor.prototype.rollbackBatch = function (checkpoint, trades) {
        return __awaiter(this, void 0, void 0, function () {
            var _i, trades_1, trade, currentBalance;
            var _a;
            var _b, _c, _d;
            return __generator(this, function (_e) {
                console.log('🔄 Rolling back failed batch...');
                // Restore merkle tree
                merkle_1.merkleTree.restoreFromCheckpoint(checkpoint);
                // 🔧 CLEAN BALANCE ROLLBACK
                for (_i = 0, trades_1 = trades; _i < trades_1.length; _i++) {
                    trade = trades_1[_i];
                    try {
                        // Restore exactly what we did:
                        // 1. Add back the fees we deducted
                        if (trade.fees) {
                            database_1.database.addBalance(trade.trader, trade.fees.totalFees);
                            console.log("\u21A9\uFE0F Restored ".concat(Number(trade.fees.totalFees) / 1e6, " fees to ").concat(trade.trader));
                        }
                        currentBalance = database_1.database.getUserBalance(trade.trader);
                        if (currentBalance.locked >= (((_b = trade.fees) === null || _b === void 0 ? void 0 : _b.netMargin) || 0n)) {
                            database_1.database.unlockBalance(trade.trader, ((_c = trade.fees) === null || _c === void 0 ? void 0 : _c.netMargin) || 0n);
                            console.log("\uD83D\uDD13 Unlocked $".concat(Number(((_d = trade.fees) === null || _d === void 0 ? void 0 : _d.netMargin) || 0n) / 1e6, " margin for ").concat(trade.trader));
                        }
                        else {
                            console.warn("\u26A0\uFE0F Insufficient locked balance for rollback: ".concat(trade.trader));
                        }
                    }
                    catch (error) {
                        console.error("\u274C Failed to rollback trade ".concat(trade.tradeId, ":"), error);
                    }
                }
                // Add trades back to pending
                (_a = this.pendingTrades).unshift.apply(_a, trades);
                console.log('✅ Batch rollback complete');
                return [2 /*return*/];
            });
        });
    };
    // ====================================================================
    // UNCHANGED METHODS (keeping existing logic)
    // ====================================================================
    MinimalExecutor.prototype.validateTrade = function (payload) {
        return __awaiter(this, void 0, void 0, function () {
            var errors, qty, margin, minSize, maxSize, leverage, tradeAge, isPaused, error_3;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        errors = [];
                        // Basic validation
                        if (!payload.trader || !payload.trader.startsWith('0x')) {
                            errors.push('Invalid trader address');
                        }
                        if (payload.assetId < 0 || payload.assetId > 4) {
                            errors.push('Invalid asset ID (must be 0-4)');
                        }
                        qty = BigInt(payload.qty);
                        if (qty <= 0n) {
                            errors.push('Position size must be positive');
                        }
                        margin = BigInt(payload.margin);
                        if (margin <= 0n) {
                            errors.push('Margin must be positive');
                        }
                        minSize = 10n * Math.pow(10n, 6n);
                        maxSize = 100000n * Math.pow(10n, 6n);
                        if (qty > maxSize) {
                            errors.push("Position too large: $".concat(Number(qty) / 1e6, " > $").concat(Number(maxSize) / 1e6));
                        }
                        leverage = Number(qty) / Number(margin);
                        if (leverage > 10) {
                            errors.push("Leverage too high: ".concat(leverage.toFixed(2), "x > 10x"));
                        }
                        tradeAge = Date.now() - payload.timestamp;
                        if (tradeAge > 120000) { // 2 minutes
                            errors.push("Trade too old: ".concat(Math.floor(tradeAge / 1000), "s > 120s"));
                        }
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, contracts_1.contractManager.isAssetPaused(payload.assetId)];
                    case 2:
                        isPaused = _a.sent();
                        if (isPaused) {
                            errors.push("Asset ".concat(payload.assetId, " is currently paused"));
                        }
                        return [3 /*break*/, 4];
                    case 3:
                        error_3 = _a.sent();
                        console.warn('Could not check asset pause status');
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/, {
                            isValid: errors.length === 0,
                            errors: errors
                        }];
                }
            });
        });
    };
    MinimalExecutor.prototype.calculateAndValidateFees = function (payload) {
        return __awaiter(this, void 0, void 0, function () {
            var fees, userBalance;
            return __generator(this, function (_a) {
                try {
                    fees = fees_1.feeCalculator.calculateNewPositionFees(BigInt(payload.qty), BigInt(payload.margin), payload.isLong);
                    userBalance = database_1.database.getUserBalance(payload.trader);
                    if (userBalance.available < BigInt(payload.margin)) {
                        return [2 /*return*/, {
                                success: false,
                                error: "Insufficient balance: $".concat(Number(userBalance.available) / 1e6, " < $").concat(Number(BigInt(payload.margin)) / 1e6)
                            }];
                    }
                    return [2 /*return*/, {
                            success: true,
                            fees: {
                                openingFee: fees.openingFee,
                                totalFees: fees.totalFees,
                                netMargin: fees.netMargin
                            }
                        }];
                }
                catch (error) {
                    return [2 /*return*/, {
                            success: false,
                            error: error instanceof Error ? error.message : 'Fee calculation failed'
                        }];
                }
                return [2 /*return*/];
            });
        });
    };
    MinimalExecutor.prototype.calculateAssetDeltas = function (trades) {
        var _a;
        console.log('📊 Calculating net deltas per asset...');
        var assetDeltas = new Map();
        for (var _i = 0, trades_2 = trades; _i < trades_2.length; _i++) {
            var trade = trades_2[_i];
            if (!assetDeltas.has(trade.assetId)) {
                assetDeltas.set(trade.assetId, {
                    netQtyDelta: 0n,
                    netMarginDelta: 0n,
                    trades: []
                });
            }
            var data = assetDeltas.get(trade.assetId);
            // Net quantity: positive for long, negative for short
            var signedQty = trade.isLong ? trade.qty : -trade.qty;
            data.netQtyDelta += signedQty;
            // 🔧 Net margin: use the net margin that's actually locked
            data.netMarginDelta += ((_a = trade.fees) === null || _a === void 0 ? void 0 : _a.netMargin) || 0n;
            data.trades.push(trade);
        }
        // Log deltas
        for (var _b = 0, assetDeltas_1 = assetDeltas; _b < assetDeltas_1.length; _b++) {
            var _c = assetDeltas_1[_b], assetId = _c[0], data = _c[1];
            console.log("   Asset ".concat(assetId, ": netQty=").concat(this.formatDelta(data.netQtyDelta), ", netMargin=$").concat(Number(data.netMarginDelta) / 1e6));
        }
        return assetDeltas;
    };
    MinimalExecutor.prototype.updatePositionsAndMerkleTree = function (trades) {
        return __awaiter(this, void 0, void 0, function () {
            var contractRoot, localOldRoot, _i, trades_3, trade, currentPrice, position, newRoot;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        console.log('🌳 Updating positions and merkle tree...');
                        return [4 /*yield*/, contracts_1.contractManager.getCurrentRoot(0)];
                    case 1:
                        contractRoot = _b.sent();
                        console.log("\uD83D\uDCCB Contract root: ".concat(contractRoot));
                        localOldRoot = merkle_1.merkleTree.getCurrentRootHex();
                        console.log("\uD83D\uDCCB Local root: ".concat(localOldRoot));
                        if (contractRoot.toLowerCase() !== localOldRoot.toLowerCase()) {
                            console.log("\u26A0\uFE0F Root mismatch detected - syncing to contract root");
                        }
                        _i = 0, trades_3 = trades;
                        _b.label = 2;
                    case 2:
                        if (!(_i < trades_3.length)) return [3 /*break*/, 5];
                        trade = trades_3[_i];
                        return [4 /*yield*/, contracts_1.contractManager.getCurrentPrice(trade.assetId)];
                    case 3:
                        currentPrice = _b.sent();
                        position = {
                            trader: trade.trader,
                            assetId: trade.assetId,
                            size: trade.isLong ? trade.qty : -trade.qty,
                            margin: ((_a = trade.fees) === null || _a === void 0 ? void 0 : _a.netMargin) || trade.margin, // 🔧 Store the actual locked margin
                            entryPrice: currentPrice,
                            lastUpdate: Date.now()
                        };
                        merkle_1.merkleTree.updatePosition(position);
                        _b.label = 4;
                    case 4:
                        _i++;
                        return [3 /*break*/, 2];
                    case 5:
                        newRoot = merkle_1.merkleTree.getCurrentRootHex();
                        console.log("\u2705 Updated ".concat(trades.length, " positions"));
                        console.log("\uD83C\uDF33 Root transition: ".concat(contractRoot.substring(0, 10), "... \u2192 ").concat(newRoot.substring(0, 10), "..."));
                        return [2 /*return*/, {
                                oldRoot: contractRoot,
                                newRoot: newRoot
                            }];
                }
            });
        });
    };
    MinimalExecutor.prototype.submitBatchToContract = function (assetDeltas, oldRoot, newRoot) {
        return __awaiter(this, void 0, void 0, function () {
            var assetIds, netDeltas, marginDeltas, oldRoots, newRoots, _i, assetDeltas_2, _a, assetId, data, contractRoot, txHash;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        console.log('📤 Submitting batch to contract...');
                        assetIds = [];
                        netDeltas = [];
                        marginDeltas = [];
                        oldRoots = [];
                        newRoots = [];
                        _i = 0, assetDeltas_2 = assetDeltas;
                        _b.label = 1;
                    case 1:
                        if (!(_i < assetDeltas_2.length)) return [3 /*break*/, 4];
                        _a = assetDeltas_2[_i], assetId = _a[0], data = _a[1];
                        return [4 /*yield*/, contracts_1.contractManager.getCurrentRoot(assetId)];
                    case 2:
                        contractRoot = _b.sent();
                        assetIds.push(assetId);
                        netDeltas.push(data.netQtyDelta);
                        marginDeltas.push(data.netMarginDelta);
                        oldRoots.push(contractRoot);
                        newRoots.push(newRoot);
                        console.log("\uD83D\uDCCB Asset ".concat(assetId, ": Contract root=").concat(contractRoot.substring(0, 10), "..., New root=").concat(newRoot.substring(0, 10), "..."));
                        _b.label = 3;
                    case 3:
                        _i++;
                        return [3 /*break*/, 1];
                    case 4: return [4 /*yield*/, contracts_1.contractManager.processBatch(assetIds, oldRoots, newRoots, netDeltas, marginDeltas)];
                    case 5:
                        txHash = _b.sent();
                        console.log("\u2705 Contract call successful: ".concat(txHash));
                        return [2 /*return*/, txHash];
                }
            });
        });
    };
    // ====================================================================
    // UTILITIES
    // ====================================================================
    MinimalExecutor.prototype.forceBatchProcessing = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        console.log('🚀 Force processing batch...');
                        return [4 /*yield*/, this.processBatch()];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    MinimalExecutor.prototype.startBatchTimer = function () {
        var _this = this;
        if (this.batchTimer) {
            clearTimeout(this.batchTimer);
        }
        this.batchTimer = setTimeout(function () {
            if (_this.pendingTrades.length > 0 && !_this.processingBatch) {
                console.log('⏰ Batch timeout reached, processing pending trades...');
                _this.processBatch();
            }
            else {
                _this.startBatchTimer();
            }
        }, this.BATCH_TIMEOUT);
    };
    MinimalExecutor.prototype.createFailedTrade = function (tradeId, error, payload) {
        return {
            tradeId: tradeId,
            trader: (payload === null || payload === void 0 ? void 0 : payload.trader) || '',
            assetId: (payload === null || payload === void 0 ? void 0 : payload.assetId) || 0,
            qty: payload ? BigInt(payload.qty) : 0n,
            margin: payload ? BigInt(payload.margin) : 0n,
            isLong: (payload === null || payload === void 0 ? void 0 : payload.isLong) || true,
            timestamp: (payload === null || payload === void 0 ? void 0 : payload.timestamp) || Date.now(),
            isValid: false,
            errors: [error]
        };
    };
    MinimalExecutor.prototype.generateTradeId = function () {
        this.tradeCounter++;
        var timestamp = Date.now();
        var random = Math.random().toString(36).substring(2, 8);
        return "trade_".concat(timestamp, "_").concat(this.tradeCounter, "_").concat(random);
    };
    MinimalExecutor.prototype.generateBatchId = function () {
        this.batchCounter++;
        var timestamp = Date.now();
        return "batch_".concat(timestamp, "_").concat(this.batchCounter);
    };
    MinimalExecutor.prototype.formatDelta = function (delta) {
        var abs = delta < 0n ? -delta : delta;
        var sign = delta < 0n ? '-' : '+';
        return "".concat(sign, "$").concat(Number(abs) / 1e6);
    };
    MinimalExecutor.prototype.getPendingTrades = function () {
        return __spreadArray([], this.pendingTrades, true);
    };
    MinimalExecutor.prototype.getStats = function () {
        var nextBatchIn = this.batchTimer ? this.BATCH_TIMEOUT : 0;
        return {
            pendingTrades: this.pendingTrades.length,
            totalProcessed: this.tradeCounter,
            totalBatches: this.batchCounter,
            isProcessing: this.processingBatch,
            nextBatchIn: nextBatchIn
        };
    };
    MinimalExecutor.prototype.clear = function () {
        this.pendingTrades = [];
        this.tradeCounter = 0;
        this.batchCounter = 0;
        if (this.batchTimer) {
            clearTimeout(this.batchTimer);
        }
        this.startBatchTimer();
        console.log('🧹 Executor cleared');
    };
    return MinimalExecutor;
}());
exports.MinimalExecutor = MinimalExecutor;
exports.executor = new MinimalExecutor();
