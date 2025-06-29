"use strict";
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
var express_1 = require("express");
var cors_1 = require("cors");
var crypto_1 = require("./crypto");
var database_1 = require("./database");
var fees_1 = require("./fees");
var merkle_1 = require("./merkle");
var contracts_1 = require("./contracts");
var executor_1 = require("./executor");
var close_executor_1 = require("./close-executor");
// ====================================================================
// MINIMAL API SERVER FOR TESTING
// ====================================================================
// Global BigInt serialization fix
var originalJSON = JSON.stringify;
JSON.stringify = function (value, replacer, space) {
    return originalJSON(value, function (key, val) {
        if (typeof val === 'bigint') {
            return val.toString();
        }
        return typeof replacer === 'function' ? replacer(key, val) : val;
    }, space);
};
var app = (0, express_1.default)();
var PORT = process.env.PORT || 8080;
// Middleware
app.use((0, cors_1.default)());
app.use(express_1.default.json({ limit: '1mb' }));
// Request logging
app.use(function (req, res, next) {
    console.log("\uD83D\uDCE1 ".concat(req.method, " ").concat(req.path, " - ").concat(new Date().toISOString()));
    next();
});
// ====================================================================
// 1. HEALTH & STATUS
// ====================================================================
/**
 * Health check
 */
app.get('/ping', function (req, res) {
    res.json({
        status: 'ok',
        message: 'Minimal Private Perps Executor',
        timestamp: new Date().toISOString()
    });
});
/**
 * System status
 */
app.get('/status', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, contractStatus, executorStats, databaseStats, merkleStats, closeExecutorStats, error_1;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 2, , 3]);
                return [4 /*yield*/, Promise.all([
                        contracts_1.contractManager.getStatus(),
                        executor_1.executor.getStats(),
                        database_1.database.getStats(),
                        merkle_1.merkleTree.getStats(),
                        close_executor_1.closeExecutor.getStats()
                    ])];
            case 1:
                _a = _b.sent(), contractStatus = _a[0], executorStats = _a[1], databaseStats = _a[2], merkleStats = _a[3], closeExecutorStats = _a[4];
                res.json({
                    status: 'healthy',
                    contracts: contractStatus,
                    executor: executorStats,
                    database: databaseStats,
                    merkleTree: merkleStats,
                    closeExecutor: closeExecutorStats,
                    crypto: crypto_1.cryptoManager.getStatus(),
                    fees: fees_1.feeCalculator.getFeeSummary(),
                    timestamp: new Date().toISOString()
                });
                return [3 /*break*/, 3];
            case 2:
                error_1 = _b.sent();
                res.status(500).json({
                    success: false,
                    error: 'Failed to get system status',
                    details: error_1 instanceof Error ? error_1.message : 'Unknown error'
                });
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); });
// ====================================================================
// 2. CRYPTO INITIALIZATION
// ====================================================================
/**
 * Initialize crypto system
 */
app.post('/setup/crypto', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, forceRegenerate, publicKey, error_2;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 2, , 3]);
                _a = req.body.forceRegenerate, forceRegenerate = _a === void 0 ? false : _a;
                return [4 /*yield*/, crypto_1.cryptoManager.initialize(forceRegenerate)];
            case 1:
                publicKey = _b.sent();
                res.json({
                    success: true,
                    message: 'Crypto system initialized',
                    publicKey: publicKey,
                    timestamp: new Date().toISOString()
                });
                return [3 /*break*/, 3];
            case 2:
                error_2 = _b.sent();
                console.error('❌ Crypto initialization failed:', error_2);
                res.status(500).json({
                    success: false,
                    error: error_2 instanceof Error ? error_2.message : 'Crypto initialization failed'
                });
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); });
/**
 * Get public key
 */
app.get('/crypto/public-key', function (req, res) {
    try {
        var publicKey = crypto_1.cryptoManager.getPublicKey();
        res.json({
            success: true,
            publicKey: publicKey,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        res.status(404).json({
            success: false,
            error: 'Public key not found. Initialize crypto system first.'
        });
    }
});
// ====================================================================
// 3. BALANCE MANAGEMENT
// ====================================================================
/**
 * Manually add user balance (for testing)
 */
app.post('/balance/add', function (req, res) {
    try {
        var _a = req.body, user = _a.user, amount = _a.amount;
        if (!user || !amount) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: user, amount'
            });
        }
        var amountBigInt = BigInt(amount);
        database_1.database.addBalance(user, amountBigInt);
        var newBalance = database_1.database.getUserBalance(user);
        res.json({
            success: true,
            message: 'Balance added successfully',
            user: user,
            balance: {
                total: newBalance.total.toString(),
                available: newBalance.available.toString(),
                locked: newBalance.locked.toString(),
                lastUpdate: newBalance.lastUpdate
            },
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        res.status(400).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to add balance'
        });
    }
});
/**
 * Get user balance
 */
app.get('/balance/:user', function (req, res) {
    try {
        var user = req.params.user;
        var balance = database_1.database.getUserBalance(user);
        res.json({
            success: true,
            user: user,
            balance: {
                total: balance.total.toString(),
                available: balance.available.toString(),
                locked: balance.locked.toString(),
                lastUpdate: balance.lastUpdate
            },
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to fetch balance'
        });
    }
});
/**
 * Get all balances
 */
app.get('/balance/all', function (req, res) {
    try {
        var allBalances = database_1.database.getAllBalances();
        res.json({
            success: true,
            balances: allBalances.map(function (_a) {
                var address = _a.address, balance = _a.balance;
                return ({
                    address: address,
                    balance: {
                        total: balance.total.toString(),
                        available: balance.available.toString(),
                        locked: balance.locked.toString(),
                        lastUpdate: balance.lastUpdate
                    }
                });
            }),
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to fetch balances'
        });
    }
});
// ====================================================================
// 4. TRADE SUBMISSION
// ====================================================================
/**
 * Submit encrypted trade (main endpoint)
 */
app.post('/trade/submit', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, enc, ct, encryptedData, processedTrade, error_3;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 2, , 3]);
                _a = req.body, enc = _a.enc, ct = _a.ct;
                if (!enc || !ct) {
                    return [2 /*return*/, res.status(400).json({
                            success: false,
                            error: 'Missing required fields: enc, ct'
                        })];
                }
                console.log('📝 Processing encrypted trade submission...');
                encryptedData = { enc: enc, ct: ct };
                return [4 /*yield*/, executor_1.executor.processEncryptedTrade(encryptedData)];
            case 1:
                processedTrade = _b.sent();
                res.json({
                    success: true,
                    message: 'Trade processed successfully',
                    trade: {
                        tradeId: processedTrade.tradeId,
                        trader: processedTrade.trader,
                        assetId: processedTrade.assetId,
                        qty: processedTrade.qty.toString(),
                        margin: processedTrade.margin.toString(),
                        isLong: processedTrade.isLong,
                        isValid: processedTrade.isValid,
                        errors: processedTrade.errors,
                        fees: processedTrade.fees ? {
                            openingFee: processedTrade.fees.openingFee.toString(),
                            totalFees: processedTrade.fees.totalFees.toString(),
                            netMargin: processedTrade.fees.netMargin.toString()
                        } : undefined
                    },
                    executor: {
                        pendingTrades: executor_1.executor.getPendingTrades().length
                    },
                    timestamp: new Date().toISOString()
                });
                return [3 /*break*/, 3];
            case 2:
                error_3 = _b.sent();
                console.error('❌ Trade submission failed:', error_3);
                res.status(400).json({
                    success: false,
                    error: error_3 instanceof Error ? error_3.message : 'Trade submission failed'
                });
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); });
/**
 * Create sample encrypted trade (for testing)
 */
app.post('/trade/create-sample', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var overrides, encrypted, error_4;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                overrides = req.body || {};
                return [4 /*yield*/, crypto_1.cryptoManager.createSampleEncryptedTrade(overrides)];
            case 1:
                encrypted = _a.sent();
                res.json({
                    success: true,
                    message: 'Sample trade created with real signature',
                    encrypted: {
                        enc: encrypted.enc,
                        ct: encrypted.ct
                    },
                    instructions: 'Use this encrypted data with POST /trade/submit',
                    timestamp: new Date().toISOString()
                });
                return [3 /*break*/, 3];
            case 2:
                error_4 = _a.sent();
                res.status(500).json({
                    success: false,
                    error: error_4 instanceof Error ? error_4.message : 'Failed to create sample trade'
                });
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); });
/**
 * Create simple test trade (no signature verification)
 */
app.post('/trade/create-test', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var sampleTrade, testPayload, encrypted, error_5;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                sampleTrade = {
                    trader: req.body.trader || "0x742d35Cc6635C0532925a3b8FF1F4b4a5c2b9876",
                    assetId: req.body.assetId || 0,
                    qty: req.body.qty || "500000000", // $500
                    margin: req.body.margin || "50000000", // $50
                    isLong: req.body.isLong !== undefined ? req.body.isLong : true,
                    timestamp: Date.now()
                };
                testPayload = {
                    payload: sampleTrade,
                    signature: "TEST_MODE", // Special test signature
                    burnerWallet: sampleTrade.trader
                };
                return [4 /*yield*/, crypto_1.cryptoManager.encryptJSON(testPayload)];
            case 1:
                encrypted = _a.sent();
                res.json({
                    success: true,
                    message: 'Test trade created (no signature verification)',
                    encrypted: {
                        enc: encrypted.enc,
                        ct: encrypted.ct
                    },
                    trade: sampleTrade,
                    instructions: 'Use this encrypted data with POST /trade/submit',
                    timestamp: new Date().toISOString()
                });
                return [3 /*break*/, 3];
            case 2:
                error_5 = _a.sent();
                res.status(500).json({
                    success: false,
                    error: error_5 instanceof Error ? error_5.message : 'Failed to create test trade'
                });
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); });
// ====================================================================
// 4B. POSITION CLOSING
// ====================================================================
/**
 * Create close position request
 */
app.post('/trade/create-close', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var closeRequest, encrypted, error_6;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                closeRequest = {
                    trader: req.body.trader || "0x742d35Cc6635C0532925a3b8FF1F4b4a5c2b9876",
                    assetId: req.body.assetId || 0,
                    closePercent: req.body.closePercent || 100, // Default full close
                    timestamp: Date.now()
                };
                return [4 /*yield*/, crypto_1.cryptoManager.createSampleClosePosition(closeRequest)];
            case 1:
                encrypted = _a.sent();
                res.json({
                    success: true,
                    message: 'Close position request created',
                    encrypted: {
                        enc: encrypted.enc,
                        ct: encrypted.ct
                    },
                    closeRequest: closeRequest,
                    instructions: 'Use this encrypted data with POST /trade/close',
                    timestamp: new Date().toISOString()
                });
                return [3 /*break*/, 3];
            case 2:
                error_6 = _a.sent();
                res.status(500).json({
                    success: false,
                    error: error_6 instanceof Error ? error_6.message : 'Failed to create close request'
                });
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); });
/**
 * Submit close position request
 */
app.post('/trade/close', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, enc, ct, encryptedData, processedClose, error_7;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 2, , 3]);
                _a = req.body, enc = _a.enc, ct = _a.ct;
                if (!enc || !ct) {
                    return [2 /*return*/, res.status(400).json({
                            success: false,
                            error: 'Missing required fields: enc, ct'
                        })];
                }
                console.log('🔄 Processing encrypted close submission...');
                encryptedData = { enc: enc, ct: ct };
                return [4 /*yield*/, close_executor_1.closeExecutor.processEncryptedClose(encryptedData)];
            case 1:
                processedClose = _b.sent();
                res.json({
                    success: true,
                    message: 'Close position processed',
                    close: {
                        closeId: processedClose.closeId,
                        trader: processedClose.trader,
                        assetId: processedClose.assetId,
                        closePercent: processedClose.closePercent,
                        marketData: {
                            entryPrice: processedClose.marketData.entryPrice.toString(),
                            currentPrice: processedClose.marketData.currentPrice.toString(),
                            priceChange: "".concat(processedClose.marketData.priceChange > 0 ? '+' : '').concat(processedClose.marketData.priceChange.toFixed(2), "%")
                        },
                        pnl: {
                            unrealizedPnL: processedClose.pnl.unrealizedPnL.toString(),
                            unrealizedPnLUSD: "$".concat((Number(processedClose.pnl.unrealizedPnL) / 1e6).toFixed(2)),
                            closingFees: processedClose.pnl.closingFees.toString(),
                            closingFeesUSD: "$".concat((Number(processedClose.pnl.closingFees) / 1e6).toFixed(2)),
                            netPayout: processedClose.pnl.netPayout.toString(),
                            netPayoutUSD: "$".concat((Number(processedClose.pnl.netPayout) / 1e6).toFixed(2))
                        },
                        position: {
                            originalSize: processedClose.position.originalSize.toString(),
                            closeSize: processedClose.position.closeSize.toString(),
                            remainingSize: processedClose.position.remainingSize.toString(),
                            isFullClose: processedClose.position.isFullClose
                        },
                        isValid: processedClose.isValid,
                        errors: processedClose.errors
                    },
                    executor: {
                        pendingCloses: close_executor_1.closeExecutor.getPendingCloses().length
                    },
                    timestamp: new Date().toISOString()
                });
                return [3 /*break*/, 3];
            case 2:
                error_7 = _b.sent();
                console.error('❌ Close submission failed:', error_7);
                res.status(400).json({
                    success: false,
                    error: error_7 instanceof Error ? error_7.message : 'Close submission failed'
                });
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); });
// ====================================================================
// 5. BATCH PROCESSING
// ====================================================================
/**
 * Get pending trades
 */
app.get('/batch/pending', function (req, res) {
    try {
        var pendingTrades = executor_1.executor.getPendingTrades();
        res.json({
            success: true,
            pendingTrades: pendingTrades.map(function (trade) { return ({
                tradeId: trade.tradeId,
                trader: trade.trader,
                assetId: trade.assetId,
                qty: trade.qty.toString(),
                margin: trade.margin.toString(),
                isLong: trade.isLong,
                isValid: trade.isValid,
                errors: trade.errors,
                timestamp: trade.timestamp
            }); }),
            count: pendingTrades.length,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to fetch pending trades'
        });
    }
});
/**
 * Force batch processing
 */
app.post('/batch/process', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var result, error_8;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                console.log('🚀 Manual batch processing requested...');
                return [4 /*yield*/, executor_1.executor.forceBatchProcessing()];
            case 1:
                result = _a.sent();
                if (!result) {
                    return [2 /*return*/, res.json({
                            success: true,
                            message: 'No trades to process',
                            timestamp: new Date().toISOString()
                        })];
                }
                res.json({
                    success: true,
                    message: result.success ? 'Batch processed successfully' : 'Batch processing failed',
                    batch: {
                        batchId: result.batchId,
                        processedTrades: result.processedTrades,
                        assetIds: result.assetIds,
                        netDeltas: result.netDeltas.map(function (d) { return d.toString(); }),
                        marginDeltas: result.marginDeltas.map(function (d) { return d.toString(); }),
                        oldRoot: result.oldRoot,
                        newRoot: result.newRoot,
                        txHash: result.txHash,
                        totalFees: result.totalFees.toString(),
                        success: result.success,
                        error: result.error
                    },
                    timestamp: new Date().toISOString()
                });
                return [3 /*break*/, 3];
            case 2:
                error_8 = _a.sent();
                res.status(500).json({
                    success: false,
                    error: error_8 instanceof Error ? error_8.message : 'Batch processing failed'
                });
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); });
// ====================================================================
// 5B. CLOSE BATCH PROCESSING
// ====================================================================
/**
 * Get pending closes
 */
app.get('/close/pending', function (req, res) {
    try {
        var pendingCloses = close_executor_1.closeExecutor.getPendingCloses();
        res.json({
            success: true,
            pendingCloses: pendingCloses.map(function (close) { return ({
                closeId: close.closeId,
                trader: close.trader,
                assetId: close.assetId,
                closePercent: close.closePercent,
                unrealizedPnL: close.pnl.unrealizedPnL.toString(),
                netPayout: close.pnl.netPayout.toString(),
                isFullClose: close.position.isFullClose,
                timestamp: close.timestamp
            }); }),
            count: pendingCloses.length,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to fetch pending closes'
        });
    }
});
/**
 * Force close batch processing
 */
app.post('/close/process', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var result, error_9;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                console.log('🚀 Manual close batch processing requested...');
                return [4 /*yield*/, close_executor_1.closeExecutor.forceCloseBatchProcessing()];
            case 1:
                result = _a.sent();
                if (!result) {
                    return [2 /*return*/, res.json({
                            success: true,
                            message: 'No closes to process',
                            timestamp: new Date().toISOString()
                        })];
                }
                res.json({
                    success: true,
                    message: result.success ? 'Close batch processed successfully' : 'Close batch processing failed',
                    batch: {
                        batchId: result.batchId,
                        processedCloses: result.processedCloses,
                        totalPnL: result.totalPnL.toString(),
                        totalPnLUSD: "$".concat((Number(result.totalPnL) / 1e6).toFixed(2)),
                        totalFees: result.totalFees.toString(),
                        totalFeesUSD: "$".concat((Number(result.totalFees) / 1e6).toFixed(2)),
                        totalPayout: result.totalPayout.toString(),
                        totalPayoutUSD: "$".concat((Number(result.totalPayout) / 1e6).toFixed(2)),
                        affectedAssets: result.affectedAssets,
                        oldRoot: result.oldRoot,
                        newRoot: result.newRoot,
                        txHash: result.txHash,
                        success: result.success,
                        error: result.error
                    },
                    timestamp: new Date().toISOString()
                });
                return [3 /*break*/, 3];
            case 2:
                error_9 = _a.sent();
                res.status(500).json({
                    success: false,
                    error: error_9 instanceof Error ? error_9.message : 'Close batch processing failed'
                });
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); });
// ====================================================================
// 6. POSITIONS & MERKLE TREE
// ====================================================================
/**
 * Get user positions
 */
app.get('/position/:user', function (req, res) {
    try {
        var user = req.params.user;
        var positions = database_1.database.getTraderPositions(user);
        res.json({
            success: true,
            user: user,
            positions: positions.map(function (pos) { return ({
                assetId: pos.assetId,
                size: pos.size.toString(),
                margin: pos.margin.toString(),
                entryPrice: pos.entryPrice.toString(),
                isLong: pos.size > 0n,
                lastUpdate: pos.lastUpdate
            }); }),
            count: positions.length,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to fetch positions'
        });
    }
});
/**
 * Get merkle proof for position
 */
app.get('/merkle/proof/:trader/:assetId', function (req, res) {
    try {
        var _a = req.params, trader = _a.trader, assetId = _a.assetId;
        var proof = merkle_1.merkleTree.generateProof(trader, parseInt(assetId));
        if (!proof) {
            return res.status(404).json({
                success: false,
                error: 'Position not found in merkle tree'
            });
        }
        res.json({
            success: true,
            proof: {
                root: proof.root.toString(),
                leaf: proof.leaf.toString(),
                siblings: proof.siblings.map(function (s) { return s.toString(); }),
                pathIndices: proof.pathIndices,
                leafIndex: proof.leafIndex
            },
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to generate merkle proof'
        });
    }
});
/**
 * Get merkle tree stats
 */
app.get('/merkle/stats', function (req, res) {
    try {
        var stats = merkle_1.merkleTree.getStats();
        res.json({
            success: true,
            merkleTree: stats,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to fetch merkle tree stats'
        });
    }
});
// ====================================================================
// 6B. PNL & ANALYTICS
// ====================================================================
/**
 * Get current PnL for user positions
 */
app.get('/pnl/:user', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var user, assetId, pnlData, error_10;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                user = req.params.user;
                assetId = req.query.assetId;
                console.log("\uD83D\uDCCA Getting PnL for user: ".concat(user).concat(assetId ? " asset: ".concat(assetId) : ''));
                return [4 /*yield*/, close_executor_1.closeExecutor.calculateCurrentPnL(user, assetId ? parseInt(assetId) : undefined)];
            case 1:
                pnlData = _a.sent();
                res.json({
                    success: true,
                    trader: pnlData.trader,
                    summary: {
                        totalUnrealizedPnL: pnlData.totalUnrealizedPnL.toString(),
                        totalUnrealizedPnLUSD: "$".concat((Number(pnlData.totalUnrealizedPnL) / 1e6).toFixed(2)),
                        totalClosingFees: pnlData.totalClosingFees.toString(),
                        totalClosingFeesUSD: "$".concat((Number(pnlData.totalClosingFees) / 1e6).toFixed(2)),
                        netPnL: pnlData.netPnL.toString(),
                        netPnLUSD: "$".concat((Number(pnlData.netPnL) / 1e6).toFixed(2)),
                        positionCount: pnlData.positions.length,
                        status: pnlData.netPnL > 0n ? 'PROFIT' : pnlData.netPnL < 0n ? 'LOSS' : 'BREAKEVEN'
                    },
                    positions: pnlData.positions.map(function (pos) { return ({
                        assetId: pos.assetId,
                        side: pos.isLong ? 'LONG' : 'SHORT',
                        size: pos.size.toString(),
                        sizeUSD: "$".concat((Number(pos.size < 0n ? -pos.size : pos.size) / 1e6).toFixed(2)),
                        entryPrice: pos.entryPrice.toString(),
                        entryPriceFormatted: "$".concat((Number(pos.entryPrice) / 1e18).toFixed(2)),
                        currentPrice: pos.currentPrice.toString(),
                        currentPriceFormatted: "$".concat((Number(pos.currentPrice) / 1e18).toFixed(2)),
                        unrealizedPnL: pos.unrealizedPnL.toString(),
                        unrealizedPnLUSD: "$".concat((Number(pos.unrealizedPnL) / 1e6).toFixed(2)),
                        closingFees: pos.closingFees.toString(),
                        closingFeesUSD: "$".concat((Number(pos.closingFees) / 1e6).toFixed(2)),
                        netPnL: pos.netPnL.toString(),
                        netPnLUSD: "$".concat((Number(pos.netPnL) / 1e6).toFixed(2)),
                        pnlPercent: "".concat(pos.pnlPercent > 0 ? '+' : '').concat(pos.pnlPercent.toFixed(2), "%"),
                        healthFactor: pos.healthFactor.toFixed(2),
                        status: pos.netPnL > 0n ? 'PROFIT' : pos.netPnL < 0n ? 'LOSS' : 'BREAKEVEN'
                    }); }),
                    timestamp: new Date().toISOString()
                });
                return [3 /*break*/, 3];
            case 2:
                error_10 = _a.sent();
                console.error('❌ Failed to calculate PnL:', error_10);
                res.status(500).json({
                    success: false,
                    error: error_10 instanceof Error ? error_10.message : 'Failed to calculate PnL'
                });
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); });
// ====================================================================
// 7. FEES & CONFIGURATION
// ====================================================================
/**
 * Get fee configuration
 */
app.get('/fees/config', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, localConfig, contractConfig, error_11;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 2, , 3]);
                return [4 /*yield*/, Promise.all([
                        fees_1.feeCalculator.getFeeSummary(),
                        contracts_1.contractManager.getFeeConfig()
                    ])];
            case 1:
                _a = _b.sent(), localConfig = _a[0], contractConfig = _a[1];
                res.json({
                    success: true,
                    fees: {
                        local: localConfig,
                        contract: {
                            openFee: "".concat(contractConfig.openFeeBps / 100, "%"),
                            closeFee: "".concat(contractConfig.closeFeeBps / 100, "%"),
                            borrowingRateAnnual: "".concat(contractConfig.borrowingRateAnnualBps / 100, "%"),
                            minCollateralRatio: "".concat(contractConfig.minCollateralRatioBps / 100, "%"),
                            maxUtilization: "".concat(contractConfig.maxUtilizationBps / 100, "%")
                        }
                    },
                    timestamp: new Date().toISOString()
                });
                return [3 /*break*/, 3];
            case 2:
                error_11 = _b.sent();
                res.status(500).json({
                    success: false,
                    error: 'Failed to fetch fee configuration'
                });
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); });
/**
 * Calculate fees for a position
 */
app.post('/fees/calculate', function (req, res) {
    try {
        var _a = req.body, positionSize = _a.positionSize, margin = _a.margin, isLong = _a.isLong;
        if (!positionSize || !margin || typeof isLong !== 'boolean') {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: positionSize, margin, isLong'
            });
        }
        var fees = fees_1.feeCalculator.calculateNewPositionFees(BigInt(positionSize), BigInt(margin), isLong);
        res.json({
            success: true,
            fees: {
                openingFee: fees.openingFee.toString(),
                totalFees: fees.totalFees.toString(),
                netMargin: fees.netMargin.toString()
            },
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        res.status(400).json({
            success: false,
            error: error instanceof Error ? error.message : 'Fee calculation failed'
        });
    }
});
// ====================================================================
// 8. TESTING UTILITIES
// ====================================================================
/**
 * Clear all data (testing only)
 */
app.post('/test/clear', function (req, res) {
    try {
        database_1.database.clear();
        merkle_1.merkleTree.clear();
        executor_1.executor.clear();
        res.json({
            success: true,
            message: 'All data cleared',
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to clear data'
        });
    }
});
/**
 * Verify system integrity
 */
app.get('/test/verify', function (req, res) {
    try {
        var merkleIntegrity = merkle_1.merkleTree.verifyIntegrity();
        res.json({
            success: true,
            integrity: {
                merkleTree: merkleIntegrity,
                overall: merkleIntegrity
            },
            message: merkleIntegrity ? 'System integrity verified' : 'System integrity check failed',
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: 'Integrity verification failed'
        });
    }
});
// ====================================================================
// ERROR HANDLING
// ====================================================================
// Global error handler
app.use(function (error, req, res, next) {
    console.error('💥 Unhandled error:', error);
    res.status(500).json({
        success: false,
        error: 'Internal server error',
        details: error.message
    });
});
// 404 handler
app.use(function (req, res) {
    res.status(404).json({
        success: false,
        error: "Endpoint not found: ".concat(req.method, " ").concat(req.path),
        availableEndpoints: [
            'GET /ping - Health check',
            'GET /status - System status',
            'POST /setup/crypto - Initialize crypto',
            'GET /crypto/public-key - Get public key',
            'POST /balance/add - Add user balance',
            'GET /balance/:user - Get user balance',
            'GET /balance/all - Get all balances',
            'POST /trade/submit - Submit encrypted trade',
            'POST /trade/create-sample - Create sample trade (real signature)',
            'POST /trade/create-test - Create test trade (no signature verification)',
            'GET /batch/pending - Get pending trades',
            'POST /batch/process - Force batch processing',
            'GET /position/:user - Get user positions',
            'GET /merkle/proof/:trader/:assetId - Get merkle proof',
            'GET /merkle/stats - Get merkle tree stats',
            'GET /fees/config - Get fee configuration',
            'POST /fees/calculate - Calculate fees',
            'POST /test/clear - Clear all data',
            'GET /test/verify - Verify system integrity'
        ]
    });
});
// ====================================================================
// SERVER STARTUP
// ====================================================================
function startServer() {
    return __awaiter(this, void 0, void 0, function () {
        var connected, error_12;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 3, , 4]);
                    console.log('🚀 Starting Minimal Private Perps Executor...');
                    // Initialize crypto system
                    return [4 /*yield*/, crypto_1.cryptoManager.initialize()];
                case 1:
                    // Initialize crypto system
                    _a.sent();
                    return [4 /*yield*/, contracts_1.contractManager.checkConnection()];
                case 2:
                    connected = _a.sent();
                    if (!connected) {
                        console.warn('⚠️ Contract connectivity issues - some features may not work');
                    }
                    app.listen(PORT, function () {
                        console.log("\u2705 Server running on http://localhost:".concat(PORT));
                        console.log('');
                        console.log('📋 Essential endpoints:');
                        console.log('  POST /setup/crypto              - Initialize crypto system');
                        console.log('  GET  /crypto/public-key         - Get public key for encryption');
                        console.log('  POST /balance/add               - Add user balance (testing)');
                        console.log('  POST /trade/submit              - Submit encrypted trade');
                        console.log('  POST /trade/create-sample       - Create sample encrypted trade (real signature)');
                        console.log('  POST /trade/create-test         - Create test trade (no signature verification)');
                        console.log('  POST /batch/process             - Force batch processing');
                        console.log('  GET  /status                    - Full system status');
                        console.log('');
                        console.log('🔑 Ready for testing on Avalanche Fuji!');
                    });
                    return [3 /*break*/, 4];
                case 3:
                    error_12 = _a.sent();
                    console.error('❌ Failed to start server:', error_12);
                    process.exit(1);
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    });
}
// Start the server
startServer();
