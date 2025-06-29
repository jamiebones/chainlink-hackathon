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
exports.contractManager = exports.ContractManager = void 0;
var ethers_1 = require("ethers");
var dotenv = require("dotenv");
dotenv.config();
// ====================================================================
// AVALANCHE FUJI CONTRACT INTEGRATION
// ====================================================================
// Avalanche Fuji configuration
var FUJI_RPC_URL = process.env.RPC_URL || 'https://api.avax-test.network/ext/bc/C/rpc';
var CHAIN_ID = 43113; // Avalanche Fuji
// Contract addresses (to be provided)
var PERP_ENGINE_ZK_ADDRESS = process.env.PERP_ENGINE_ZK_ADDRESS || '';
var PERP_ENGINE_ADDRESS = process.env.PERP_ENGINE_ADDRESS || '';
var CHAINLINK_MANAGER_ADDRESS = process.env.CHAINLINK_MANAGER_ADDRESS || '';
// Minimal ABIs for essential functions
var PERP_ENGINE_ZK_ABI = [
    "function processBatch(uint8[] assetIds, bytes32[] oldRoots, bytes32[] newRoots, int256[] netDeltas, int256[] marginDeltas) external",
    "function getCurrentRoot(uint8 assetId) external view returns (bytes32)",
    "function initializeAsset(uint8 assetId, bytes32 initialRoot) external",
    "event RootUpdated(uint8 indexed assetId, bytes32 oldRoot, bytes32 newRoot)",
    "event BatchProcessed(uint8[] assetIds, int256[] netDeltas, int256[] marginDeltas)"
];
var PERP_ENGINE_ABI = [
    "function getOpenInterest(uint8 asset) external view returns (uint256 longUsd, uint256 shortUsd)",
    "function getFundingRate(uint8 asset) external view returns (int256)",
    "function openFeeBps() external view returns (uint256)",
    "function closeFeeBps() external view returns (uint256)",
    "function borrowingRateAnnualBps() external view returns (uint256)",
    "function minCollateralRatioBps() external view returns (uint256)",
    "function maxUtilizationBps() external view returns (uint256)",
    "function isPaused() external view returns (bool)"
];
var CHAINLINK_MANAGER_ABI = [
    "function getPrice(uint8 asset) external view returns (uint256)",
    "function checkIfAssetIsPaused(uint8 assetType) external view returns (bool)"
];
var ContractManager = /** @class */ (function () {
    function ContractManager() {
        this.perpEngineZK = null;
        this.perpEngine = null;
        this.chainlinkManager = null;
        console.log('🔗 Initializing contract manager for Avalanche Fuji...');
        var privateKey = process.env.EXECUTOR_PRIVATE_KEY;
        if (!privateKey) {
            throw new Error('EXECUTOR_PRIVATE_KEY not set in environment');
        }
        // Initialize provider and signer
        this.provider = new ethers_1.ethers.JsonRpcProvider(FUJI_RPC_URL);
        this.signer = new ethers_1.ethers.Wallet(privateKey, this.provider);
        this.initializeContracts();
        console.log("\u2705 Contract manager initialized on Fuji");
        console.log("\uD83D\uDD11 Executor address: ".concat(this.signer.address));
    }
    // ====================================================================
    // CONTRACT INITIALIZATION
    // ====================================================================
    ContractManager.prototype.initializeContracts = function () {
        try {
            // Initialize PerpEngineZK (main contract for privacy)
            if (PERP_ENGINE_ZK_ADDRESS) {
                this.perpEngineZK = new ethers_1.Contract(PERP_ENGINE_ZK_ADDRESS, PERP_ENGINE_ZK_ABI, this.signer);
                console.log("\uD83D\uDD17 PerpEngineZK connected: ".concat(PERP_ENGINE_ZK_ADDRESS));
            }
            else {
                console.warn('⚠️ PERP_ENGINE_ZK_ADDRESS not set');
            }
            // Initialize PerpEngine (for configuration and data)
            if (PERP_ENGINE_ADDRESS) {
                this.perpEngine = new ethers_1.Contract(PERP_ENGINE_ADDRESS, PERP_ENGINE_ABI, this.provider);
                console.log("\uD83D\uDD17 PerpEngine connected: ".concat(PERP_ENGINE_ADDRESS));
            }
            else {
                console.warn('⚠️ PERP_ENGINE_ADDRESS not set');
            }
            // Initialize ChainLink Manager (for prices)
            if (CHAINLINK_MANAGER_ADDRESS) {
                this.chainlinkManager = new ethers_1.Contract(CHAINLINK_MANAGER_ADDRESS, CHAINLINK_MANAGER_ABI, this.provider);
                console.log("\uD83D\uDD17 ChainLinkManager connected: ".concat(CHAINLINK_MANAGER_ADDRESS));
            }
            else {
                console.warn('⚠️ CHAINLINK_MANAGER_ADDRESS not set');
            }
        }
        catch (error) {
            console.error('❌ Failed to initialize contracts:', error);
        }
    };
    // ====================================================================
    // BATCH PROCESSING (MAIN FUNCTION)
    // ====================================================================
    /**
     * Submit batch to PerpEngineZK contract
     */
    ContractManager.prototype.processBatch = function (assetIds, oldRoots, newRoots, netDeltas, marginDeltas) {
        return __awaiter(this, void 0, void 0, function () {
            var mockTxHash, tx, receipt, error_1;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.perpEngineZK) {
                            throw new Error('PerpEngineZK contract not initialized');
                        }
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 6, , 7]);
                        console.log('📤 Submitting batch to PerpEngineZK...');
                        console.log("   Assets: [".concat(assetIds.join(', '), "]"));
                        console.log("   Net deltas: [".concat(netDeltas.map(function (d) { return _this.formatDelta(d); }).join(', '), "]"));
                        console.log("   Margin deltas: [".concat(marginDeltas.map(function (d) { return _this.formatUSDC(d); }).join(', '), "]"));
                        console.log("   Old roots: [".concat(oldRoots.map(function (r) { return r.substring(0, 10) + '...'; }).join(', '), "]"));
                        console.log("   New roots: [".concat(newRoots.map(function (r) { return r.substring(0, 10) + '...'; }).join(', '), "]"));
                        if (!(!PERP_ENGINE_ZK_ADDRESS || PERP_ENGINE_ZK_ADDRESS === '')) return [3 /*break*/, 3];
                        console.log('🧪 Mock mode: No contract address set, simulating success');
                        mockTxHash = '0x' + Date.now().toString(16).padStart(64, '0');
                        return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 2000); })];
                    case 2:
                        _a.sent(); // Simulate network delay
                        return [2 /*return*/, mockTxHash];
                    case 3: return [4 /*yield*/, this.perpEngineZK.processBatch(assetIds, oldRoots, newRoots, netDeltas, marginDeltas, {
                            gasLimit: 1000000, // Fixed gas limit
                            maxFeePerGas: ethers_1.ethers.parseUnits('30', 'gwei'), // Fuji gas price
                            maxPriorityFeePerGas: ethers_1.ethers.parseUnits('2', 'gwei')
                        })];
                    case 4:
                        tx = _a.sent();
                        console.log("\uD83D\uDE80 Transaction submitted: ".concat(tx.hash));
                        console.log("\u23F3 Waiting for confirmation...");
                        return [4 /*yield*/, tx.wait()];
                    case 5:
                        receipt = _a.sent();
                        if ((receipt === null || receipt === void 0 ? void 0 : receipt.status) === 1) {
                            console.log("\u2705 Batch processed successfully!");
                            console.log("\uD83D\uDCCB Transaction: ".concat(tx.hash));
                            console.log("\u26FD Gas used: ".concat(receipt.gasUsed.toString()));
                            console.log("\uD83E\uDDF1 Block: ".concat(receipt.blockNumber));
                            return [2 /*return*/, tx.hash];
                        }
                        else {
                            throw new Error('Transaction failed');
                        }
                        return [3 /*break*/, 7];
                    case 6:
                        error_1 = _a.sent();
                        console.error('❌ Batch processing failed:', error_1);
                        if (error_1 instanceof Error) {
                            // Provide helpful error messages for common contract revert reasons
                            if (error_1.message.includes('not owner')) {
                                throw new Error('Access denied: Not contract owner');
                            }
                            else if (error_1.message.includes('stale root')) {
                                throw new Error('Stale root: Contract root doesn\'t match provided oldRoot');
                            }
                            else if (error_1.message.includes('length mismatch')) {
                                throw new Error('Array length mismatch in batch parameters');
                            }
                            else if (error_1.message.includes('insufficient funds')) {
                                throw new Error('Insufficient AVAX for gas fees');
                            }
                        }
                        throw new Error("Batch processing failed: ".concat(error_1 instanceof Error ? error_1.message : 'Unknown error'));
                    case 7: return [2 /*return*/];
                }
            });
        });
    };
    // ====================================================================
    // MERKLE ROOT OPERATIONS
    // ====================================================================
    /**
     * Get current merkle root for an asset
     */
    ContractManager.prototype.getCurrentRoot = function (assetId) {
        return __awaiter(this, void 0, void 0, function () {
            var root, error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.perpEngineZK) {
                            throw new Error('PerpEngineZK contract not initialized');
                        }
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, this.perpEngineZK.getCurrentRoot(assetId)];
                    case 2:
                        root = _a.sent();
                        return [2 /*return*/, root];
                    case 3:
                        error_2 = _a.sent();
                        console.error("Failed to fetch merkle root for asset ".concat(assetId, ":"), error_2);
                        return [2 /*return*/, '0x' + '0'.repeat(64)]; // Return zero root on error
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Initialize asset with initial root
     */
    ContractManager.prototype.initializeAsset = function (assetId, initialRoot) {
        return __awaiter(this, void 0, void 0, function () {
            var tx, receipt, error_3;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.perpEngineZK) {
                            throw new Error('PerpEngineZK contract not initialized');
                        }
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 4, , 5]);
                        console.log("\uD83C\uDF33 Initializing asset ".concat(assetId, " with root: ").concat(initialRoot));
                        return [4 /*yield*/, this.perpEngineZK.initializeAsset(assetId, initialRoot)];
                    case 2:
                        tx = _a.sent();
                        return [4 /*yield*/, tx.wait()];
                    case 3:
                        receipt = _a.sent();
                        if ((receipt === null || receipt === void 0 ? void 0 : receipt.status) === 1) {
                            console.log("\u2705 Asset ".concat(assetId, " initialized: ").concat(tx.hash));
                            return [2 /*return*/, tx.hash];
                        }
                        else {
                            throw new Error('Asset initialization transaction failed');
                        }
                        return [3 /*break*/, 5];
                    case 4:
                        error_3 = _a.sent();
                        console.error("Failed to initialize asset ".concat(assetId, ":"), error_3);
                        throw new Error("Asset initialization failed: ".concat(error_3 instanceof Error ? error_3.message : 'Unknown error'));
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    // ====================================================================
    // PRICE & MARKET DATA
    // ====================================================================
    /**
     * Get current price for an asset
     */
    ContractManager.prototype.getCurrentPrice = function (assetId) {
        return __awaiter(this, void 0, void 0, function () {
            var price, error_4;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.chainlinkManager) {
                            console.warn('ChainLinkManager not available, using fallback price');
                            return [2 /*return*/, this.getFallbackPrice(assetId)];
                        }
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, this.chainlinkManager.getPrice(assetId)];
                    case 2:
                        price = _a.sent();
                        return [2 /*return*/, BigInt(price.toString())];
                    case 3:
                        error_4 = _a.sent();
                        console.warn("Failed to fetch price for asset ".concat(assetId, ", using fallback:"), error_4);
                        return [2 /*return*/, this.getFallbackPrice(assetId)];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Check if asset is paused
     */
    ContractManager.prototype.isAssetPaused = function (assetId) {
        return __awaiter(this, void 0, void 0, function () {
            var error_5;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.chainlinkManager) {
                            return [2 /*return*/, false]; // Assume not paused if can't check
                        }
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, this.chainlinkManager.checkIfAssetIsPaused(assetId)];
                    case 2: return [2 /*return*/, _a.sent()];
                    case 3:
                        error_5 = _a.sent();
                        console.warn("Failed to check pause status for asset ".concat(assetId, ":"), error_5);
                        return [2 /*return*/, false];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get fallback prices for testing
     */
    ContractManager.prototype.getFallbackPrice = function (assetId) {
        var fallbackPrices = {
            0: 200n * Math.pow(10n, 18n), // TSLA: $200
            1: 150n * Math.pow(10n, 18n), // AAPL: $150
            2: 350n * Math.pow(10n, 18n), // MSFT: $350
            3: 2800n * Math.pow(10n, 18n), // GOOGL: $2800
            4: 3200n * Math.pow(10n, 18n) // AMZN: $3200
        };
        return fallbackPrices[assetId] || 1000n * Math.pow(10n, 18n);
    };
    // ====================================================================
    // CONTRACT CONFIGURATION
    // ====================================================================
    /**
     * Get fee configuration from contract
     */
    ContractManager.prototype.getFeeConfig = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _a, openFeeBps, closeFeeBps, borrowingRateAnnualBps, minCollateralRatioBps, maxUtilizationBps, error_6;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (!this.perpEngine) {
                            console.warn('PerpEngine not available, using fallback config');
                            return [2 /*return*/, this.getFallbackFeeConfig()];
                        }
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, Promise.all([
                                this.perpEngine.openFeeBps(),
                                this.perpEngine.closeFeeBps(),
                                this.perpEngine.borrowingRateAnnualBps(),
                                this.perpEngine.minCollateralRatioBps(),
                                this.perpEngine.maxUtilizationBps()
                            ])];
                    case 2:
                        _a = _b.sent(), openFeeBps = _a[0], closeFeeBps = _a[1], borrowingRateAnnualBps = _a[2], minCollateralRatioBps = _a[3], maxUtilizationBps = _a[4];
                        return [2 /*return*/, {
                                openFeeBps: Number(openFeeBps),
                                closeFeeBps: Number(closeFeeBps),
                                borrowingRateAnnualBps: Number(borrowingRateAnnualBps),
                                minCollateralRatioBps: Number(minCollateralRatioBps),
                                maxUtilizationBps: Number(maxUtilizationBps)
                            }];
                    case 3:
                        error_6 = _b.sent();
                        console.warn('Failed to fetch fee config from contract, using fallback:', error_6);
                        return [2 /*return*/, this.getFallbackFeeConfig()];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get open interest for an asset
     */
    ContractManager.prototype.getOpenInterest = function (assetId) {
        return __awaiter(this, void 0, void 0, function () {
            var _a, longUsd, shortUsd, error_7;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (!this.perpEngine) {
                            return [2 /*return*/, { longUsd: 0n, shortUsd: 0n }];
                        }
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, this.perpEngine.getOpenInterest(assetId)];
                    case 2:
                        _a = _b.sent(), longUsd = _a[0], shortUsd = _a[1];
                        return [2 /*return*/, {
                                longUsd: BigInt(longUsd.toString()),
                                shortUsd: BigInt(shortUsd.toString())
                            }];
                    case 3:
                        error_7 = _b.sent();
                        console.warn("Failed to fetch open interest for asset ".concat(assetId, ":"), error_7);
                        return [2 /*return*/, { longUsd: 0n, shortUsd: 0n }];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get funding rate for an asset
     */
    ContractManager.prototype.getFundingRate = function (assetId) {
        return __awaiter(this, void 0, void 0, function () {
            var rate, error_8;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.perpEngine) {
                            return [2 /*return*/, 0n];
                        }
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, this.perpEngine.getFundingRate(assetId)];
                    case 2:
                        rate = _a.sent();
                        return [2 /*return*/, BigInt(rate.toString())];
                    case 3:
                        error_8 = _a.sent();
                        console.warn("Failed to fetch funding rate for asset ".concat(assetId, ":"), error_8);
                        return [2 /*return*/, 0n];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Fallback fee configuration
     */
    ContractManager.prototype.getFallbackFeeConfig = function () {
        return {
            openFeeBps: 10, // 0.1%
            closeFeeBps: 10, // 0.1%
            borrowingRateAnnualBps: 1000, // 10%
            minCollateralRatioBps: 1000, // 10%
            maxUtilizationBps: 8000 // 80%
        };
    };
    // ====================================================================
    // NETWORK UTILITIES
    // ====================================================================
    /**
     * Get current block number
     */
    ContractManager.prototype.getCurrentBlock = function () {
        return __awaiter(this, void 0, void 0, function () {
            var error_9;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, this.provider.getBlockNumber()];
                    case 1: return [2 /*return*/, _a.sent()];
                    case 2:
                        error_9 = _a.sent();
                        console.error('Failed to get current block:', error_9);
                        return [2 /*return*/, 0];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get executor balance (AVAX)
     */
    ContractManager.prototype.getExecutorBalance = function () {
        return __awaiter(this, void 0, void 0, function () {
            var balance, error_10;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, this.provider.getBalance(this.signer.address)];
                    case 1:
                        balance = _a.sent();
                        return [2 /*return*/, BigInt(balance.toString())];
                    case 2:
                        error_10 = _a.sent();
                        console.error('Failed to get executor balance:', error_10);
                        return [2 /*return*/, 0n];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Check network connectivity
     */
    ContractManager.prototype.checkConnection = function () {
        return __awaiter(this, void 0, void 0, function () {
            var blockNumber, error_11;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, this.provider.getBlockNumber()];
                    case 1:
                        blockNumber = _a.sent();
                        console.log("\uD83C\uDF10 Connected to Fuji - Block: ".concat(blockNumber));
                        return [2 /*return*/, true];
                    case 2:
                        error_11 = _a.sent();
                        console.error('❌ Network connection failed:', error_11);
                        return [2 /*return*/, false];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    // ====================================================================
    // UTILITIES
    // ====================================================================
    ContractManager.prototype.formatUSDC = function (amount) {
        return (Number(amount) / 1e6).toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    };
    ContractManager.prototype.formatDelta = function (delta) {
        var abs = delta < 0n ? -delta : delta;
        var sign = delta < 0n ? '-' : '+';
        return "".concat(sign, "$").concat(this.formatUSDC(abs));
    };
    ContractManager.prototype.formatAVAX = function (amount) {
        return (Number(amount) / 1e18).toFixed(4);
    };
    /**
     * Get contract addresses
     */
    ContractManager.prototype.getContractAddresses = function () {
        return {
            perpEngineZK: PERP_ENGINE_ZK_ADDRESS,
            perpEngine: PERP_ENGINE_ADDRESS,
            chainlinkManager: CHAINLINK_MANAGER_ADDRESS
        };
    };
    /**
     * Get executor info
     */
    ContractManager.prototype.getExecutorInfo = function () {
        return {
            address: this.signer.address,
            chainId: CHAIN_ID,
            rpcUrl: FUJI_RPC_URL
        };
    };
    /**
     * Get status for health check
     */
    ContractManager.prototype.getStatus = function () {
        return __awaiter(this, void 0, void 0, function () {
            var connected, executorBalance, currentBlock;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.checkConnection()];
                    case 1:
                        connected = _a.sent();
                        return [4 /*yield*/, this.getExecutorBalance()];
                    case 2:
                        executorBalance = _a.sent();
                        return [4 /*yield*/, this.getCurrentBlock()];
                    case 3:
                        currentBlock = _a.sent();
                        return [2 /*return*/, {
                                connected: connected,
                                executorAddress: this.signer.address,
                                executorBalance: "".concat(this.formatAVAX(executorBalance), " AVAX"),
                                currentBlock: currentBlock,
                                contracts: {
                                    perpEngineZK: !!this.perpEngineZK && !!PERP_ENGINE_ZK_ADDRESS,
                                    perpEngine: !!this.perpEngine && !!PERP_ENGINE_ADDRESS,
                                    chainlinkManager: !!this.chainlinkManager && !!CHAINLINK_MANAGER_ADDRESS
                                }
                            }];
                }
            });
        });
    };
    return ContractManager;
}());
exports.ContractManager = ContractManager;
// Export singleton instance
exports.contractManager = new ContractManager();
