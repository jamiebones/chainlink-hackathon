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
exports.perpEngineZkContract = exports.wallet = exports.provider = void 0;
exports.getPrice = getPrice;
exports.getAsset = getAsset;
exports.getMerkleRoot = getMerkleRoot;
exports.getCumulativeFunding = getCumulativeFunding;
exports.submitNetTrade = submitNetTrade;
exports.submitLiquidation = submitLiquidation;
exports.settleFunding = settleFunding;
exports.canSettleFunding = canSettleFunding;
exports.getTimeTillNextFunding = getTimeTillNextFunding;
exports.listenToContractEvents = listenToContractEvents;
exports.processBatch = processBatch;
// src/contracts.ts
var ethers_1 = require("ethers");
var PerpEngineZK_json_1 = require("./abis/PerpEngineZK.json");
var ChainlinkFeedABI = ['function latestRoundData() view returns (uint80,int256,uint256,uint256,uint80)'];
var PRICE_FEEDS = {
    0: process.env.TSLA_FEED_ADDRESS, // TSLA/USD
    1: process.env.AAPL_FEED_ADDRESS, // AAPL/USD
    // Add more as needed
};
// Initialize contracts
exports.provider = new ethers_1.JsonRpcProvider(process.env.RPC_URL);
exports.wallet = new ethers_1.Wallet(process.env.EXECUTOR_PRIVATE_KEY, exports.provider);
exports.perpEngineZkContract = new ethers_1.Contract(process.env.PERP_ENGINE_ZK_ADDRESS, PerpEngineZK_json_1.default.abi, exports.wallet);
// ChainLink Feed
function getPrice(assetId) {
    return __awaiter(this, void 0, void 0, function () {
        var feedAddress, feed, _a, price;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    feedAddress = PRICE_FEEDS[assetId];
                    if (!feedAddress) {
                        throw new Error("No price feed for asset ".concat(assetId));
                    }
                    feed = new ethers_1.Contract(feedAddress, ChainlinkFeedABI, exports.provider);
                    return [4 /*yield*/, feed.latestRoundData()];
                case 1:
                    _a = _b.sent(), price = _a[1];
                    return [2 /*return*/, BigInt(price)]; // Returns price in 1e8 format
            }
        });
    });
}
// ========================================
// Basic Contract Functions
// ========================================
function getAsset(assetId) {
    return __awaiter(this, void 0, void 0, function () {
        var asset;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, exports.perpEngineZkContract.asset(assetId)];
                case 1:
                    asset = _a.sent();
                    return [2 /*return*/, {
                            root: asset.root,
                            lpNetQty: BigInt(asset.lpNetQty),
                            lpMargin: BigInt(asset.lpMargin),
                            cumFunding: BigInt(asset.cumFunding),
                            lastFundingTs: Number(asset.lastFundingTs)
                        }];
            }
        });
    });
}
function getMerkleRoot(assetId) {
    return __awaiter(this, void 0, void 0, function () {
        var asset;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getAsset(assetId)];
                case 1:
                    asset = _a.sent();
                    return [2 /*return*/, asset.root];
            }
        });
    });
}
function getCumulativeFunding(assetId) {
    return __awaiter(this, void 0, void 0, function () {
        var asset;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getAsset(assetId)];
                case 1:
                    asset = _a.sent();
                    return [2 /*return*/, asset.cumFunding];
            }
        });
    });
}
// ========================================
// Trading Functions
// ========================================
function submitNetTrade(assetId, qty, marginDelta) {
    return __awaiter(this, void 0, void 0, function () {
        var tx;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log("\uD83D\uDCE4 Submitting net trade: asset ".concat(assetId, ", qty ").concat(qty, ", margin ").concat(marginDelta));
                    return [4 /*yield*/, exports.perpEngineZkContract.tradeNet(assetId, qty, marginDelta, {
                            gasLimit: 300000
                        })];
                case 1:
                    tx = _a.sent();
                    return [4 /*yield*/, tx.wait()];
                case 2:
                    _a.sent();
                    console.log("\u2705 Net trade confirmed: ".concat(tx.hash));
                    return [2 /*return*/, tx.hash];
            }
        });
    });
}
// ========================================
// Liquidation Functions
// ========================================
function submitLiquidation(assetId, oldRoot, newRoot, trader, size, margin, entryFunding, proof) {
    return __awaiter(this, void 0, void 0, function () {
        var tx;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log("\u26A1 Submitting liquidation: ".concat(trader, " asset ").concat(assetId));
                    return [4 /*yield*/, exports.perpEngineZkContract.verifyAndLiquidate(assetId, oldRoot, newRoot, trader, size, margin, entryFunding, proof, { gasLimit: 600000 })];
                case 1:
                    tx = _a.sent();
                    return [4 /*yield*/, tx.wait()];
                case 2:
                    _a.sent();
                    console.log("\u2705 Liquidation confirmed: ".concat(tx.hash));
                    return [2 /*return*/, tx.hash];
            }
        });
    });
}
// ========================================
// Funding Functions
// ========================================
function settleFunding(assetId, premium) {
    return __awaiter(this, void 0, void 0, function () {
        var tx;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log("\uD83D\uDCB0 Settling funding: asset ".concat(assetId, ", premium ").concat(premium));
                    return [4 /*yield*/, exports.perpEngineZkContract.settleFunding(assetId, premium, {
                            gasLimit: 150000
                        })];
                case 1:
                    tx = _a.sent();
                    return [4 /*yield*/, tx.wait()];
                case 2:
                    _a.sent();
                    console.log("\u2705 Funding settled: ".concat(tx.hash));
                    return [2 /*return*/, tx.hash];
            }
        });
    });
}
function canSettleFunding(assetId) {
    return __awaiter(this, void 0, void 0, function () {
        var asset, currentTime, FUNDING_PERIOD;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getAsset(assetId)];
                case 1:
                    asset = _a.sent();
                    currentTime = Math.floor(Date.now() / 1000);
                    FUNDING_PERIOD = 3600;
                    return [2 /*return*/, currentTime >= asset.lastFundingTs + FUNDING_PERIOD];
            }
        });
    });
}
function getTimeTillNextFunding(assetId) {
    return __awaiter(this, void 0, void 0, function () {
        var asset, currentTime, FUNDING_PERIOD, nextFundingTime;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getAsset(assetId)];
                case 1:
                    asset = _a.sent();
                    currentTime = Math.floor(Date.now() / 1000);
                    FUNDING_PERIOD = 3600;
                    nextFundingTime = asset.lastFundingTs + FUNDING_PERIOD;
                    return [2 /*return*/, Math.max(0, nextFundingTime - currentTime)];
            }
        });
    });
}
// ========================================
// Event Listening
// ========================================
function listenToContractEvents() {
    console.log('👂 Listening to contract events...');
    exports.perpEngineZkContract.on('NetTrade', function (id, qty, marginDelta, event) {
        console.log("\uD83D\uDCCA NetTrade: asset ".concat(id, ", qty ").concat(qty, ", margin ").concat(marginDelta));
    });
    exports.perpEngineZkContract.on('Liquidate', function (trader, id, size, event) {
        console.log("\u26A1 Liquidation: ".concat(trader, ", asset ").concat(id, ", size ").concat(size));
    });
    exports.perpEngineZkContract.on('FundingSettled', function (id, premium, event) {
        console.log("\uD83D\uDCB0 Funding: asset ".concat(id, ", premium ").concat(premium));
    });
    exports.perpEngineZkContract.on('RootUpdated', function (id, newRoot, event) {
        console.log("\uD83C\uDF33 Root updated: asset ".concat(id, ", root ").concat(newRoot));
    });
}
// ========================================
// Batch Processing
// ========================================
function processBatch(trades) {
    return __awaiter(this, void 0, void 0, function () {
        var netExposure, _i, trades_1, trade, _a, _b, _c, assetId, net;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    console.log("\uD83D\uDE80 Processing batch of ".concat(trades.length, " trades"));
                    netExposure = {};
                    for (_i = 0, trades_1 = trades; _i < trades_1.length; _i++) {
                        trade = trades_1[_i];
                        if (!netExposure[trade.assetId]) {
                            netExposure[trade.assetId] = { qty: 0n, marginDelta: 0n };
                        }
                        netExposure[trade.assetId].qty += trade.qty;
                        netExposure[trade.assetId].marginDelta += trade.marginDelta;
                    }
                    _a = 0, _b = Object.entries(netExposure);
                    _d.label = 1;
                case 1:
                    if (!(_a < _b.length)) return [3 /*break*/, 4];
                    _c = _b[_a], assetId = _c[0], net = _c[1];
                    if (!(net.qty !== 0n || net.marginDelta !== 0n)) return [3 /*break*/, 3];
                    return [4 /*yield*/, submitNetTrade(Number(assetId), net.qty, net.marginDelta)];
                case 2:
                    _d.sent();
                    _d.label = 3;
                case 3:
                    _a++;
                    return [3 /*break*/, 1];
                case 4: return [2 /*return*/];
            }
        });
    });
}
