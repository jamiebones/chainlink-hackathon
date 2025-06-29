"use strict";
// FIXED CLOSE EXECUTOR - PROPER MARGIN RELEASE
// Key changes marked with 🔧
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
exports.closeExecutor = exports.CloseTradeExecutor = void 0;
var crypto_1 = require("./crypto");
var database_1 = require("./database");
var fees_1 = require("./fees");
var merkle_1 = require("./merkle");
var contracts_1 = require("./contracts");
var CloseTradeExecutor = /** @class */ (function () {
    function CloseTradeExecutor() {
        this.pendingCloses = [];
        this.processingBatch = false;
        this.closeCounter = 0;
        this.batchCounter = 0;
        this.BATCH_SIZE = 3;
        this.BATCH_TIMEOUT = 20000;
        this.batchTimer = null;
        console.log('🔄 Close Trade Executor initializing...');
        this.startBatchTimer();
        console.log('✅ Close Trade Executor initialized');
        console.log("\u2699\uFE0F Close batch size: ".concat(this.BATCH_SIZE, " operations"));
        console.log("\u23F0 Close batch timeout: ".concat(this.BATCH_TIMEOUT / 1000, "s"));
    }
    // ====================================================================
    // 🔧 FIXED CLOSE PROCESSING - PROPER MARGIN HANDLING
    // ====================================================================
    CloseTradeExecutor.prototype.processEncryptedClose = function (encryptedData) {
        return __awaiter(this, void 0, void 0, function () {
            var closeId, decryptedClose, payload, validationResult, position, pnlResult, closeResult, processedClose, error_1;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        closeId = this.generateCloseId();
                        console.log("\n\uD83D\uDD04 Processing encrypted close: ".concat(closeId));
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 6, , 7]);
                        return [4 /*yield*/, crypto_1.cryptoManager.processEncryptedClose(encryptedData)];
                    case 2:
                        decryptedClose = _a.sent();
                        if (!decryptedClose.isValid) {
                            return [2 /*return*/, this.createFailedClose(closeId, decryptedClose.error || 'Decryption failed')];
                        }
                        payload = decryptedClose.payload;
                        return [4 /*yield*/, this.validateCloseRequest(payload)];
                    case 3:
                        validationResult = _a.sent();
                        if (!validationResult.isValid) {
                            return [2 /*return*/, this.createFailedClose(closeId, validationResult.errors.join(', '), payload)];
                        }
                        position = validationResult.position;
                        return [4 /*yield*/, this.calculateDetailedPnL(position, payload.closePercent)];
                    case 4:
                        pnlResult = _a.sent();
                        if (!pnlResult.success) {
                            return [2 /*return*/, this.createFailedClose(closeId, pnlResult.error, payload)];
                        }
                        return [4 /*yield*/, this.executeCloseWithMarginHandling(position, payload, pnlResult.data)];
                    case 5:
                        closeResult = _a.sent();
                        if (!closeResult.success) {
                            return [2 /*return*/, this.createFailedClose(closeId, closeResult.error, payload)];
                        }
                        processedClose = {
                            closeId: closeId,
                            trader: payload.trader,
                            assetId: payload.assetId,
                            closePercent: payload.closePercent,
                            originalPosition: position,
                            marketData: pnlResult.data.marketData,
                            pnl: pnlResult.data.pnl,
                            position: pnlResult.data.position,
                            // 🔧 Add margin tracking
                            margin: closeResult.marginData,
                            isValid: true,
                            timestamp: Date.now()
                        };
                        // Step 6: Add to pending operations
                        this.pendingCloses.push(processedClose);
                        console.log("\u2705 Close ".concat(closeId, " processed successfully"));
                        console.log("\uD83D\uDCCA ".concat(payload.trader, " closed ").concat(payload.closePercent, "% of asset ").concat(payload.assetId));
                        console.log("\uD83D\uDCB0 PnL: ".concat(this.formatPnL(pnlResult.data.pnl.unrealizedPnL)));
                        console.log("\uD83D\uDCB8 Net payout: ".concat(this.formatPnL(pnlResult.data.pnl.netPayout)));
                        console.log("\uD83D\uDD13 Margin released: $".concat(Number(closeResult.marginData.marginToRelease) / 1e6));
                        console.log("\uD83D\uDCCB Pending closes: ".concat(this.pendingCloses.length, "/").concat(this.BATCH_SIZE));
                        // Step 7: Check if we should process batch
                        if (this.pendingCloses.length >= this.BATCH_SIZE) {
                            console.log('🚀 Close batch size reached, processing immediately...');
                            setTimeout(function () { return _this.processCloseBatch(); }, 100);
                        }
                        return [2 /*return*/, processedClose];
                    case 6:
                        error_1 = _a.sent();
                        console.error("\u274C Close processing failed for ".concat(closeId, ":"), error_1);
                        return [2 /*return*/, this.createFailedClose(closeId, error_1 instanceof Error ? error_1.message : 'Unknown error')];
                    case 7: return [2 /*return*/];
                }
            });
        });
    };
    // ====================================================================
    // 🔧 NEW CLOSE EXECUTION WITH PROPER MARGIN HANDLING
    // ====================================================================
    CloseTradeExecutor.prototype.executeCloseWithMarginHandling = function (position, payload, pnlData) {
        return __awaiter(this, void 0, void 0, function () {
            var isFullClose, originalMargin, marginToRelease, remainingMargin, marginUnlocked, pnlAdded, positionUpdated, updatedPosition, finalBalance;
            return __generator(this, function (_a) {
                try {
                    isFullClose = payload.closePercent >= 100;
                    originalMargin = position.margin;
                    marginToRelease = isFullClose
                        ? originalMargin
                        : (originalMargin * BigInt(payload.closePercent)) / 100n;
                    remainingMargin = originalMargin - marginToRelease;
                    console.log("\uD83D\uDCB0 Margin calculation:");
                    console.log("   Original margin: $".concat(Number(originalMargin) / 1e6));
                    console.log("   Margin to release: $".concat(Number(marginToRelease) / 1e6));
                    console.log("   Remaining margin: $".concat(Number(remainingMargin) / 1e6));
                    marginUnlocked = database_1.database.unlockBalance(payload.trader, marginToRelease);
                    if (!marginUnlocked) {
                        return [2 /*return*/, { success: false, error: 'Failed to unlock position margin' }];
                    }
                    console.log("\uD83D\uDD13 Unlocked $".concat(Number(marginToRelease) / 1e6, " margin"));
                    pnlAdded = database_1.database.addBalance(payload.trader, pnlData.pnl.netPayout);
                    if (!pnlAdded) {
                        // Rollback margin unlock
                        database_1.database.lockBalance(payload.trader, marginToRelease);
                        return [2 /*return*/, { success: false, error: 'Failed to add PnL to balance' }];
                    }
                    console.log("\uD83D\uDCB0 Added PnL: ".concat(this.formatPnL(pnlData.pnl.netPayout)));
                    positionUpdated = void 0;
                    if (isFullClose) {
                        // Full close: remove position entirely
                        positionUpdated = this.removePosition(payload.trader, payload.assetId);
                        console.log("\uD83D\uDDD1\uFE0F Position fully closed and removed");
                    }
                    else {
                        updatedPosition = __assign(__assign({}, position), { size: pnlData.position.remainingSize, margin: remainingMargin, lastUpdate: Date.now() });
                        positionUpdated = this.updatePosition(updatedPosition);
                        console.log("\uD83D\uDCCF Position partially closed and updated");
                    }
                    if (!positionUpdated) {
                        // Rollback balance changes
                        database_1.database.addBalance(payload.trader, 0n - pnlData.pnl.netPayout); // 🔧 Fix bigint negation
                        database_1.database.lockBalance(payload.trader, marginToRelease);
                        return [2 /*return*/, { success: false, error: 'Failed to update position' }];
                    }
                    finalBalance = database_1.database.getUserBalance(payload.trader);
                    console.log("\u2705 Final balance state:");
                    console.log("   Available: $".concat(Number(finalBalance.available) / 1e6));
                    console.log("   Locked: $".concat(Number(finalBalance.locked) / 1e6));
                    console.log("   Total: $".concat(Number(finalBalance.total) / 1e6));
                    return [2 /*return*/, {
                            success: true,
                            marginData: {
                                originalMargin: originalMargin,
                                marginToRelease: marginToRelease,
                                remainingMargin: remainingMargin
                            }
                        }];
                }
                catch (error) {
                    return [2 /*return*/, {
                            success: false,
                            error: error instanceof Error ? error.message : 'Close execution failed'
                        }];
                }
                return [2 /*return*/];
            });
        });
    };
    // ====================================================================
    // 🔧 IMPROVED POSITION MANAGEMENT
    // ====================================================================
    CloseTradeExecutor.prototype.updatePosition = function (position) {
        try {
            // Save to database
            database_1.database.savePosition(position);
            // Update in merkle tree
            merkle_1.merkleTree.updatePosition(position);
            console.log("\uD83D\uDCCA Position updated: ".concat(position.trader, " asset ").concat(position.assetId));
            console.log("   New size: ".concat(this.formatPosition(position)));
            console.log("   New margin: $".concat(Number(position.margin) / 1e6));
            return true;
        }
        catch (error) {
            console.error('Failed to update position:', error);
            return false;
        }
    };
    CloseTradeExecutor.prototype.removePosition = function (trader, assetId) {
        try {
            // Remove from database
            var key = "".concat(trader.toLowerCase(), "-").concat(assetId);
            var dbData = database_1.database.data;
            if (dbData.positions[key]) {
                delete dbData.positions[key];
                database_1.database.saveToBackup();
            }
            // Remove from merkle tree (sets to zero)
            merkle_1.merkleTree.removePosition(trader, assetId);
            console.log("\uD83D\uDDD1\uFE0F Position fully closed and removed: ".concat(trader, " asset ").concat(assetId));
            return true;
        }
        catch (error) {
            console.error('Failed to remove position:', error);
            return false;
        }
    };
    // ====================================================================
    // PNL CALCULATION (UNCHANGED)
    // ====================================================================
    CloseTradeExecutor.prototype.calculateCurrentPnL = function (trader, assetId) {
        return __awaiter(this, void 0, void 0, function () {
            var positions, totalUnrealizedPnL, totalClosingFees, positionPnLs, _i, positions_1, position, pnlData, error_2, netPnL;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        console.log("\uD83D\uDCCA Calculating PnL for trader: ".concat(trader).concat(assetId !== undefined ? " asset: ".concat(assetId) : ''));
                        positions = assetId !== undefined
                            ? database_1.database.getTraderPositions(trader).filter(function (p) { return p.assetId === assetId; })
                            : database_1.database.getTraderPositions(trader);
                        if (positions.length === 0) {
                            return [2 /*return*/, {
                                    trader: trader,
                                    assetId: assetId,
                                    totalUnrealizedPnL: 0n,
                                    totalClosingFees: 0n,
                                    netPnL: 0n,
                                    positions: []
                                }];
                        }
                        totalUnrealizedPnL = 0n;
                        totalClosingFees = 0n;
                        positionPnLs = [];
                        _i = 0, positions_1 = positions;
                        _a.label = 1;
                    case 1:
                        if (!(_i < positions_1.length)) return [3 /*break*/, 6];
                        position = positions_1[_i];
                        _a.label = 2;
                    case 2:
                        _a.trys.push([2, 4, , 5]);
                        return [4 /*yield*/, this.calculatePositionPnL(position)];
                    case 3:
                        pnlData = _a.sent();
                        positionPnLs.push({
                            assetId: position.assetId,
                            size: position.size,
                            entryPrice: position.entryPrice,
                            currentPrice: pnlData.currentPrice,
                            unrealizedPnL: pnlData.unrealizedPnL,
                            closingFees: pnlData.closingFees,
                            netPnL: pnlData.netPnL,
                            pnlPercent: pnlData.pnlPercent,
                            isLong: position.size > 0n,
                            healthFactor: pnlData.healthFactor
                        });
                        totalUnrealizedPnL += pnlData.unrealizedPnL;
                        totalClosingFees += pnlData.closingFees;
                        return [3 /*break*/, 5];
                    case 4:
                        error_2 = _a.sent();
                        console.error("\u274C Failed to calculate PnL for position ".concat(trader, "-").concat(position.assetId, ":"), error_2);
                        return [3 /*break*/, 5];
                    case 5:
                        _i++;
                        return [3 /*break*/, 1];
                    case 6:
                        netPnL = totalUnrealizedPnL - totalClosingFees;
                        console.log("\uD83D\uDCCA Total unrealized PnL: ".concat(this.formatPnL(totalUnrealizedPnL)));
                        console.log("\uD83D\uDCCA Total closing fees: ".concat(this.formatUSDC(totalClosingFees)));
                        console.log("\uD83D\uDCCA Net PnL: ".concat(this.formatPnL(netPnL)));
                        return [2 /*return*/, {
                                trader: trader,
                                assetId: assetId,
                                totalUnrealizedPnL: totalUnrealizedPnL,
                                totalClosingFees: totalClosingFees,
                                netPnL: netPnL,
                                positions: positionPnLs
                            }];
                }
            });
        });
    };
    CloseTradeExecutor.prototype.calculatePositionPnL = function (position) {
        return __awaiter(this, void 0, void 0, function () {
            var currentPrice, isLong, absSize, unrealizedPnL, closingFees, netPnL, pnlPercent, healthFactor;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, contracts_1.contractManager.getCurrentPrice(position.assetId)];
                    case 1:
                        currentPrice = _a.sent();
                        isLong = position.size > 0n;
                        absSize = isLong ? position.size : -position.size;
                        if (isLong) {
                            unrealizedPnL = (absSize * (currentPrice - position.entryPrice)) / position.entryPrice;
                        }
                        else {
                            unrealizedPnL = (absSize * (position.entryPrice - currentPrice)) / position.entryPrice;
                        }
                        closingFees = fees_1.feeCalculator.calculateClosingFee(absSize);
                        netPnL = unrealizedPnL - closingFees;
                        pnlPercent = Number((unrealizedPnL * 10000n) / position.margin) / 100;
                        healthFactor = Number((position.margin + unrealizedPnL) * 100n / position.margin) / 100;
                        return [2 /*return*/, {
                                currentPrice: currentPrice,
                                unrealizedPnL: unrealizedPnL,
                                closingFees: closingFees,
                                netPnL: netPnL,
                                pnlPercent: pnlPercent,
                                healthFactor: healthFactor
                            }];
                }
            });
        });
    };
    CloseTradeExecutor.prototype.calculateDetailedPnL = function (position, closePercent) {
        return __awaiter(this, void 0, void 0, function () {
            var currentPrice, isLong, absSize, closeSize, remainingSize, isFullClose, priceChange, unrealizedPnL, closingFees, netPayout, error_3;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, contracts_1.contractManager.getCurrentPrice(position.assetId)];
                    case 1:
                        currentPrice = _a.sent();
                        isLong = position.size > 0n;
                        absSize = isLong ? position.size : -position.size;
                        closeSize = (absSize * BigInt(closePercent)) / 100n;
                        remainingSize = absSize - closeSize;
                        isFullClose = closePercent >= 100;
                        priceChange = Number((currentPrice - position.entryPrice) * 10000n / position.entryPrice) / 100;
                        unrealizedPnL = void 0;
                        if (isLong) {
                            unrealizedPnL = (closeSize * (currentPrice - position.entryPrice)) / position.entryPrice;
                        }
                        else {
                            unrealizedPnL = (closeSize * (position.entryPrice - currentPrice)) / position.entryPrice;
                        }
                        closingFees = fees_1.feeCalculator.calculateClosingFee(closeSize);
                        netPayout = unrealizedPnL - closingFees;
                        console.log("\uD83D\uDCCA Detailed PnL calculation:");
                        console.log("   Original size: ".concat(this.formatUSDC(absSize)));
                        console.log("   Close size: ".concat(this.formatUSDC(closeSize), " (").concat(closePercent, "%)"));
                        console.log("   Entry price: ".concat(this.formatPrice(position.entryPrice)));
                        console.log("   Current price: ".concat(this.formatPrice(currentPrice)));
                        console.log("   Price change: ".concat(priceChange > 0 ? '+' : '').concat(priceChange.toFixed(2), "%"));
                        console.log("   Unrealized PnL: ".concat(this.formatPnL(unrealizedPnL)));
                        console.log("   Closing fees: ".concat(this.formatUSDC(closingFees)));
                        console.log("   Net payout: ".concat(this.formatPnL(netPayout)));
                        return [2 /*return*/, {
                                success: true,
                                data: {
                                    marketData: {
                                        entryPrice: position.entryPrice,
                                        currentPrice: currentPrice,
                                        priceChange: priceChange
                                    },
                                    pnl: {
                                        unrealizedPnL: unrealizedPnL,
                                        closingFees: closingFees,
                                        netPayout: netPayout
                                    },
                                    position: {
                                        originalSize: position.size,
                                        closeSize: isLong ? closeSize : -closeSize,
                                        remainingSize: isLong ? remainingSize : -remainingSize,
                                        isFullClose: isFullClose
                                    }
                                }
                            }];
                    case 2:
                        error_3 = _a.sent();
                        return [2 /*return*/, {
                                success: false,
                                error: error_3 instanceof Error ? error_3.message : 'PnL calculation failed'
                            }];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    // ====================================================================
    // VALIDATION (UNCHANGED)
    // ====================================================================
    CloseTradeExecutor.prototype.validateCloseRequest = function (payload) {
        return __awaiter(this, void 0, void 0, function () {
            var errors, position, requestAge, isPaused, error_4;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        errors = [];
                        if (!payload.trader || !payload.trader.startsWith('0x')) {
                            errors.push('Invalid trader address');
                        }
                        if (payload.assetId < 0 || payload.assetId > 4) {
                            errors.push('Invalid asset ID (must be 0-4)');
                        }
                        if (payload.closePercent <= 0 || payload.closePercent > 100) {
                            errors.push('Invalid close percent (must be 1-100)');
                        }
                        position = database_1.database.getPosition(payload.trader, payload.assetId);
                        if (!position) {
                            errors.push('Position not found');
                            return [2 /*return*/, { isValid: false, errors: errors }];
                        }
                        if (position.size === 0n) {
                            errors.push('Position has zero size');
                        }
                        requestAge = Date.now() - payload.timestamp;
                        if (requestAge > 120000) {
                            errors.push("Close request too old: ".concat(Math.floor(requestAge / 1000), "s > 120s"));
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
                        error_4 = _a.sent();
                        console.warn('Could not check asset pause status');
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/, {
                            isValid: errors.length === 0,
                            errors: errors,
                            position: errors.length === 0 ? position : undefined
                        }];
                }
            });
        });
    };
    // ====================================================================
    // BATCH PROCESSING WITH CONTRACT INTEGRATION (UNCHANGED)
    // ====================================================================
    CloseTradeExecutor.prototype.processCloseBatch = function () {
        return __awaiter(this, void 0, void 0, function () {
            var batchId, closes, contractDeltas, txHash, totalPnL, totalFees, totalPayout, affectedAssets, oldRoot, newRoot, result, error_5;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (this.processingBatch || this.pendingCloses.length === 0) {
                            return [2 /*return*/, null];
                        }
                        this.processingBatch = true;
                        batchId = this.generateBatchId();
                        console.log("\n\uD83C\uDFED Processing close batch ".concat(batchId, " with ").concat(this.pendingCloses.length, " closes"));
                        closes = __spreadArray([], this.pendingCloses, true);
                        this.pendingCloses = [];
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 3, 4, 5]);
                        contractDeltas = this.calculateContractDeltas(closes);
                        return [4 /*yield*/, this.submitCloseBatchToContract(contractDeltas)];
                    case 2:
                        txHash = _b.sent();
                        console.log("\uD83D\uDCB0 Contract released funds to executor via transaction: ".concat(txHash));
                        totalPnL = closes.reduce(function (sum, close) { return sum + close.pnl.unrealizedPnL; }, 0n);
                        totalFees = closes.reduce(function (sum, close) { return sum + close.pnl.closingFees; }, 0n);
                        totalPayout = closes.reduce(function (sum, close) { return sum + close.pnl.netPayout; }, 0n);
                        affectedAssets = __spreadArray([], new Set(closes.map(function (c) { return c.assetId; })), true);
                        oldRoot = merkle_1.merkleTree.getCurrentRootHex();
                        newRoot = merkle_1.merkleTree.getCurrentRootHex();
                        result = {
                            batchId: batchId,
                            processedCloses: closes.length,
                            totalPnL: totalPnL,
                            totalFees: totalFees,
                            totalPayout: totalPayout,
                            affectedAssets: affectedAssets,
                            oldRoot: oldRoot,
                            newRoot: newRoot,
                            txHash: txHash,
                            success: true,
                            timestamp: Date.now()
                        };
                        console.log("\u2705 Close batch ".concat(batchId, " processed successfully: ").concat(txHash));
                        console.log("\uD83D\uDCCA Released ".concat(this.formatPnL(totalPayout), " to users via contract"));
                        return [2 /*return*/, result];
                    case 3:
                        error_5 = _b.sent();
                        console.error("\u274C Close batch ".concat(batchId, " failed:"), error_5);
                        (_a = this.pendingCloses).unshift.apply(_a, closes);
                        console.log('⚠️ Individual closes already processed - may need manual reconciliation');
                        return [2 /*return*/, {
                                batchId: batchId,
                                processedCloses: 0,
                                totalPnL: 0n,
                                totalFees: 0n,
                                totalPayout: 0n,
                                affectedAssets: [],
                                oldRoot: merkle_1.merkleTree.getCurrentRootHex(),
                                newRoot: merkle_1.merkleTree.getCurrentRootHex(),
                                txHash: '',
                                success: false,
                                error: error_5 instanceof Error ? error_5.message : 'Unknown error',
                                timestamp: Date.now()
                            }];
                    case 4:
                        this.processingBatch = false;
                        this.startBatchTimer();
                        return [7 /*endfinally*/];
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    CloseTradeExecutor.prototype.calculateContractDeltas = function (closes) {
        console.log('📊 Calculating contract deltas for closes...');
        var deltas = new Map();
        for (var _i = 0, closes_1 = closes; _i < closes_1.length; _i++) {
            var close_1 = closes_1[_i];
            if (!deltas.has(close_1.assetId)) {
                deltas.set(close_1.assetId, {
                    netQtyDelta: 0n,
                    netMarginDelta: 0n
                });
            }
            var data = deltas.get(close_1.assetId);
            // NEGATIVE qty delta (removing position)
            data.netQtyDelta += close_1.position.closeSize;
            // 🔧 NEGATIVE margin delta (releasing funds) - use actual margin released
            data.netMarginDelta -= close_1.margin.marginToRelease;
        }
        for (var _a = 0, deltas_1 = deltas; _a < deltas_1.length; _a++) {
            var _b = deltas_1[_a], assetId = _b[0], data = _b[1];
            console.log("   Asset ".concat(assetId, ":"));
            console.log("     Qty delta: ".concat(this.formatPnL(data.netQtyDelta), " (removing positions)"));
            console.log("     Margin delta: ".concat(this.formatPnL(data.netMarginDelta), " (NEGATIVE = fund release)"));
        }
        return deltas;
    };
    CloseTradeExecutor.prototype.submitCloseBatchToContract = function (deltas) {
        return __awaiter(this, void 0, void 0, function () {
            var assetIds, netDeltas, marginDeltas, oldRoots, newRoots, newRoot, _i, deltas_2, _a, assetId, data, contractRoot, txHash;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        console.log('📤 Submitting close batch to contract...');
                        assetIds = [];
                        netDeltas = [];
                        marginDeltas = [];
                        oldRoots = [];
                        newRoots = [];
                        newRoot = merkle_1.merkleTree.getCurrentRootHex();
                        _i = 0, deltas_2 = deltas;
                        _b.label = 1;
                    case 1:
                        if (!(_i < deltas_2.length)) return [3 /*break*/, 4];
                        _a = deltas_2[_i], assetId = _a[0], data = _a[1];
                        return [4 /*yield*/, contracts_1.contractManager.getCurrentRoot(assetId)];
                    case 2:
                        contractRoot = _b.sent();
                        assetIds.push(assetId);
                        netDeltas.push(data.netQtyDelta);
                        marginDeltas.push(data.netMarginDelta);
                        oldRoots.push(contractRoot);
                        newRoots.push(newRoot);
                        console.log("\uD83D\uDCCB Asset ".concat(assetId, ":"));
                        console.log("   Contract root: ".concat(contractRoot.substring(0, 10), "..."));
                        console.log("   New root: ".concat(newRoot.substring(0, 10), "..."));
                        console.log("   Releasing: ".concat(this.formatUSDC(-data.netMarginDelta), " to executor"));
                        _b.label = 3;
                    case 3:
                        _i++;
                        return [3 /*break*/, 1];
                    case 4: return [4 /*yield*/, contracts_1.contractManager.processBatch(assetIds, oldRoots, newRoots, netDeltas, marginDeltas)];
                    case 5:
                        txHash = _b.sent();
                        console.log("\u2705 Contract will release funds to executor: ".concat(txHash));
                        return [2 /*return*/, txHash];
                }
            });
        });
    };
    // ====================================================================
    // UTILITIES
    // ====================================================================
    CloseTradeExecutor.prototype.startBatchTimer = function () {
        var _this = this;
        if (this.batchTimer) {
            clearTimeout(this.batchTimer);
        }
        this.batchTimer = setTimeout(function () {
            if (_this.pendingCloses.length > 0 && !_this.processingBatch) {
                console.log('⏰ Close batch timeout reached, processing pending closes...');
                _this.processCloseBatch();
            }
            else {
                _this.startBatchTimer();
            }
        }, this.BATCH_TIMEOUT);
    };
    CloseTradeExecutor.prototype.createFailedClose = function (closeId, error, payload) {
        return {
            closeId: closeId,
            trader: (payload === null || payload === void 0 ? void 0 : payload.trader) || '',
            assetId: (payload === null || payload === void 0 ? void 0 : payload.assetId) || 0,
            closePercent: (payload === null || payload === void 0 ? void 0 : payload.closePercent) || 0,
            originalPosition: {},
            marketData: {
                entryPrice: 0n,
                currentPrice: 0n,
                priceChange: 0
            },
            pnl: {
                unrealizedPnL: 0n,
                closingFees: 0n,
                netPayout: 0n
            },
            position: {
                originalSize: 0n,
                closeSize: 0n,
                remainingSize: 0n,
                isFullClose: false
            },
            // 🔧 Add empty margin data for failed closes
            margin: {
                originalMargin: 0n,
                marginToRelease: 0n,
                remainingMargin: 0n
            },
            isValid: false,
            errors: [error],
            timestamp: Date.now()
        };
    };
    CloseTradeExecutor.prototype.generateCloseId = function () {
        this.closeCounter++;
        var timestamp = Date.now();
        var random = Math.random().toString(36).substring(2, 8);
        return "close_".concat(timestamp, "_").concat(this.closeCounter, "_").concat(random);
    };
    CloseTradeExecutor.prototype.generateBatchId = function () {
        this.batchCounter++;
        var timestamp = Date.now();
        return "close_batch_".concat(timestamp, "_").concat(this.batchCounter);
    };
    CloseTradeExecutor.prototype.formatUSDC = function (amount) {
        var abs = amount < 0n ? -amount : amount;
        return "$".concat((Number(abs) / 1e6).toFixed(2));
    };
    CloseTradeExecutor.prototype.formatPnL = function (amount) {
        var abs = amount < 0n ? -amount : amount;
        var sign = amount < 0n ? '-' : '+';
        return "".concat(sign, "$").concat((Number(abs) / 1e6).toFixed(2));
    };
    CloseTradeExecutor.prototype.formatPrice = function (price) {
        return "$".concat((Number(price) / 1e18).toFixed(2));
    };
    CloseTradeExecutor.prototype.formatPosition = function (position) {
        var side = position.size > 0n ? 'LONG' : 'SHORT';
        var size = position.size > 0n ? position.size : -position.size;
        return "".concat(side, " $").concat((Number(size) / 1e6).toFixed(2));
    };
    // ====================================================================
    // PUBLIC QUERIES
    // ====================================================================
    CloseTradeExecutor.prototype.getPendingCloses = function () {
        return __spreadArray([], this.pendingCloses, true);
    };
    CloseTradeExecutor.prototype.forceCloseBatchProcessing = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        console.log('🚀 Force processing close batch...');
                        return [4 /*yield*/, this.processCloseBatch()];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    CloseTradeExecutor.prototype.getStats = function () {
        var nextBatchIn = this.batchTimer ? this.BATCH_TIMEOUT : 0;
        return {
            pendingCloses: this.pendingCloses.length,
            totalProcessed: this.closeCounter,
            totalBatches: this.batchCounter,
            isProcessing: this.processingBatch,
            nextBatchIn: nextBatchIn
        };
    };
    CloseTradeExecutor.prototype.clear = function () {
        this.pendingCloses = [];
        this.closeCounter = 0;
        this.batchCounter = 0;
        if (this.batchTimer) {
            clearTimeout(this.batchTimer);
        }
        this.startBatchTimer();
        console.log('🧹 Close executor cleared');
    };
    return CloseTradeExecutor;
}());
exports.CloseTradeExecutor = CloseTradeExecutor;
exports.closeExecutor = new CloseTradeExecutor();
