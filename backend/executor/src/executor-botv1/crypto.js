"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.cryptoManager = exports.CryptoManager = void 0;
var core_1 = require("@hpke/core");
var dhkem_x25519_1 = require("@hpke/dhkem-x25519");
var chacha20poly1305_1 = require("@hpke/chacha20poly1305");
var ethers_1 = require("ethers");
var fs = require("fs");
// ====================================================================
// MINIMAL CRYPTO FOR HPKE + SIGNATURE VERIFICATION
// ====================================================================
// HPKE Cipher Suite Configuration
var suite = new core_1.CipherSuite({
    kem: new dhkem_x25519_1.DhkemX25519HkdfSha256(),
    kdf: new core_1.HkdfSha256(),
    aead: new chacha20poly1305_1.Chacha20Poly1305(),
});
var CryptoManager = /** @class */ (function () {
    function CryptoManager() {
        this.privateKey = null;
        this.publicKey = null;
        this.loadKeys();
        console.log('🔐 Crypto manager initialized');
    }
    // ====================================================================
    // KEY MANAGEMENT
    // ====================================================================
    /**
     * Generate new HPKE key pair
     */
    CryptoManager.prototype.generateKeyPair = function () {
        return __awaiter(this, void 0, void 0, function () {
            var keyPair, publicKeyBuffer, privateKeyBuffer, publicKey, privateKey;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        console.log('🔑 Generating new HPKE key pair...');
                        return [4 /*yield*/, suite.kem.generateKeyPair()];
                    case 1:
                        keyPair = _a.sent();
                        return [4 /*yield*/, suite.kem.serializePublicKey(keyPair.publicKey)];
                    case 2:
                        publicKeyBuffer = _a.sent();
                        return [4 /*yield*/, suite.kem.serializePrivateKey(keyPair.privateKey)];
                    case 3:
                        privateKeyBuffer = _a.sent();
                        publicKey = this.arrayBufferToBase64url(publicKeyBuffer);
                        privateKey = this.arrayBufferToBase64url(privateKeyBuffer);
                        console.log('✅ HPKE key pair generated');
                        return [2 /*return*/, { publicKey: publicKey, privateKey: privateKey }];
                }
            });
        });
    };
    /**
     * Save key pair to files
     */
    CryptoManager.prototype.saveKeys = function (publicKey, privateKey) {
        try {
            fs.writeFileSync('.hpke-secret', privateKey);
            fs.writeFileSync('hpke-public.txt', publicKey);
            fs.chmodSync('.hpke-secret', 384); // Restrict private key access
            this.publicKey = publicKey;
            this.privateKey = privateKey;
            console.log('💾 HPKE keys saved successfully');
        }
        catch (error) {
            console.error('❌ Failed to save keys:', error);
            throw new Error('Key saving failed');
        }
    };
    /**
     * Load keys from files
     */
    CryptoManager.prototype.loadKeys = function () {
        try {
            if (fs.existsSync('.hpke-secret') && fs.existsSync('hpke-public.txt')) {
                this.privateKey = fs.readFileSync('.hpke-secret', 'utf8').trim();
                this.publicKey = fs.readFileSync('hpke-public.txt', 'utf8').trim();
                console.log('🔑 HPKE keys loaded from files');
            }
            else {
                console.log('⚠️ No existing keys found');
            }
        }
        catch (error) {
            console.error('❌ Failed to load keys:', error);
        }
    };
    /**
     * Initialize crypto system (generate keys if needed)
     */
    CryptoManager.prototype.initialize = function () {
        return __awaiter(this, arguments, void 0, function (forceRegenerate) {
            var _a, publicKey, privateKey;
            if (forceRegenerate === void 0) { forceRegenerate = false; }
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (!forceRegenerate && this.publicKey && this.privateKey) {
                            console.log('🔑 Using existing HPKE keys');
                            return [2 /*return*/, this.publicKey];
                        }
                        return [4 /*yield*/, this.generateKeyPair()];
                    case 1:
                        _a = _b.sent(), publicKey = _a.publicKey, privateKey = _a.privateKey;
                        this.saveKeys(publicKey, privateKey);
                        return [2 /*return*/, publicKey];
                }
            });
        });
    };
    /**
     * Get public key for clients
     */
    CryptoManager.prototype.getPublicKey = function () {
        if (!this.publicKey) {
            throw new Error('Public key not available. Initialize crypto system first.');
        }
        return this.publicKey;
    };
    // ====================================================================
    // ENCRYPTION/DECRYPTION
    // ====================================================================
    /**
     * Decrypt HPKE encrypted data
     */
    CryptoManager.prototype.decryptData = function (encryptedData) {
        return __awaiter(this, void 0, void 0, function () {
            var enc, ct, privateKeyBuffer, recipientKey, plaintextBuffer, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.privateKey) {
                            throw new Error('Private key not available');
                        }
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 4, , 5]);
                        console.log('🔓 Decrypting HPKE data...');
                        enc = new Uint8Array(Buffer.from(encryptedData.enc, 'base64url'));
                        ct = new Uint8Array(Buffer.from(encryptedData.ct, 'base64url'));
                        privateKeyBuffer = this.base64urlToArrayBuffer(this.privateKey);
                        return [4 /*yield*/, suite.kem.importKey('raw', privateKeyBuffer, true)];
                    case 2:
                        recipientKey = _a.sent();
                        return [4 /*yield*/, suite.open({ recipientKey: recipientKey, enc: enc }, ct)];
                    case 3:
                        plaintextBuffer = _a.sent();
                        console.log('✅ HPKE decryption successful');
                        return [2 /*return*/, new Uint8Array(plaintextBuffer)];
                    case 4:
                        error_1 = _a.sent();
                        console.error('❌ HPKE decryption failed:', error_1);
                        throw new Error('Decryption failed');
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Decrypt JSON data
     */
    CryptoManager.prototype.decryptJSON = function (encryptedData) {
        return __awaiter(this, void 0, void 0, function () {
            var plaintextBytes, jsonString;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.decryptData(encryptedData)];
                    case 1:
                        plaintextBytes = _a.sent();
                        jsonString = new TextDecoder().decode(plaintextBytes);
                        return [2 /*return*/, JSON.parse(jsonString)];
                }
            });
        });
    };
    /**
     * Encrypt JSON data (for testing)
     */
    CryptoManager.prototype.encryptJSON = function (data, recipientPublicKey) {
        return __awaiter(this, void 0, void 0, function () {
            var publicKey, jsonString, dataBytes, publicKeyBuffer, recipientKey, _a, enc, ct, encBase64, ctBase64, error_2;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        publicKey = recipientPublicKey || this.getPublicKey();
                        jsonString = JSON.stringify(data);
                        dataBytes = new TextEncoder().encode(jsonString);
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 4, , 5]);
                        console.log('🔐 Encrypting JSON data...');
                        publicKeyBuffer = this.base64urlToArrayBuffer(publicKey);
                        return [4 /*yield*/, suite.kem.importKey('raw', publicKeyBuffer, false)];
                    case 2:
                        recipientKey = _b.sent();
                        return [4 /*yield*/, suite.seal({ recipientPublicKey: recipientKey }, dataBytes)];
                    case 3:
                        _a = _b.sent(), enc = _a.enc, ct = _a.ct;
                        encBase64 = this.arrayBufferToBase64url(enc);
                        ctBase64 = this.arrayBufferToBase64url(ct);
                        console.log('✅ HPKE encryption successful');
                        return [2 /*return*/, {
                                enc: encBase64,
                                ct: ctBase64
                            }];
                    case 4:
                        error_2 = _b.sent();
                        console.error('❌ HPKE encryption failed:', error_2);
                        throw new Error('Encryption failed');
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    // ====================================================================
    // SIGNATURE VERIFICATION
    // ====================================================================
    /**
     * Verify Ethereum signature
     */
    CryptoManager.prototype.verifySignature = function (message, signature, expectedAddress) {
        try {
            // Skip verification for test mode signatures
            if (signature === "TEST_MODE") {
                console.log('🧪 Test mode signature detected - skipping verification');
                return true;
            }
            console.log('🔍 Verifying signature...');
            var recoveredAddress = (0, ethers_1.verifyMessage)(message, signature);
            var isValid = recoveredAddress.toLowerCase() === expectedAddress.toLowerCase();
            if (isValid) {
                console.log('✅ Signature verification successful');
            }
            else {
                console.error("\u274C Signature verification failed: ".concat(recoveredAddress, " !== ").concat(expectedAddress));
            }
            return isValid;
        }
        catch (error) {
            console.error('❌ Signature verification error:', error);
            return false;
        }
    };
    /**
     * Verify trade payload signature
     */
    CryptoManager.prototype.verifyTradeSignature = function (payload, signature, burnerWallet) {
        var message = JSON.stringify(payload);
        return this.verifySignature(message, signature, burnerWallet);
    };
    // ====================================================================
    // TRADE PROCESSING
    // ====================================================================
    /**
     * Decrypt and verify encrypted trade
     */
    CryptoManager.prototype.processEncryptedTrade = function (encryptedData) {
        return __awaiter(this, void 0, void 0, function () {
            var decrypted, _a, payload, signature, burnerWallet, isValid, error_3;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 2, , 3]);
                        console.log('🔄 Processing encrypted trade...');
                        return [4 /*yield*/, this.decryptJSON(encryptedData)];
                    case 1:
                        decrypted = _b.sent();
                        // Step 2: Validate structure
                        if (!decrypted.payload || !decrypted.signature || !decrypted.burnerWallet) {
                            throw new Error('Invalid encrypted payload structure');
                        }
                        _a = decrypted, payload = _a.payload, signature = _a.signature, burnerWallet = _a.burnerWallet;
                        isValid = this.verifyTradeSignature(payload, signature, burnerWallet);
                        if (!isValid) {
                            return [2 /*return*/, {
                                    payload: payload,
                                    signature: signature,
                                    burnerWallet: burnerWallet,
                                    isValid: false,
                                    error: 'Signature verification failed'
                                }];
                        }
                        console.log('✅ Encrypted trade processed successfully');
                        return [2 /*return*/, {
                                payload: payload,
                                signature: signature,
                                burnerWallet: burnerWallet,
                                isValid: true
                            }];
                    case 2:
                        error_3 = _b.sent();
                        console.error('❌ Failed to process encrypted trade:', error_3);
                        return [2 /*return*/, {
                                payload: {},
                                signature: '',
                                burnerWallet: '',
                                isValid: false,
                                error: error_3 instanceof Error ? error_3.message : 'Unknown error'
                            }];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    // ====================================================================
    // TESTING HELPERS
    // ====================================================================
    /**
     * Create sample encrypted trade (for testing)
     */
    CryptoManager.prototype.createSampleEncryptedTrade = function () {
        return __awaiter(this, arguments, void 0, function (overrides) {
            var sampleTrade, testPrivateKey, testWallet, message, signature, encryptedPayload;
            if (overrides === void 0) { overrides = {}; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        sampleTrade = __assign({ trader: "0x742d35Cc6635C0532925a3b8FF1F4b4a5c2b9876", assetId: 0, qty: "1000000000", margin: "100000000", isLong: true, timestamp: Date.now() }, overrides);
                        testPrivateKey = "0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
                        testWallet = new ethers_1.ethers.Wallet(testPrivateKey);
                        message = JSON.stringify(sampleTrade);
                        return [4 /*yield*/, testWallet.signMessage(message)];
                    case 1:
                        signature = _a.sent();
                        encryptedPayload = {
                            payload: sampleTrade,
                            signature: signature,
                            burnerWallet: testWallet.address // Use the actual test wallet address
                        };
                        return [4 /*yield*/, this.encryptJSON(encryptedPayload)];
                    case 2: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    /**
     * Process encrypted close request
     */
    CryptoManager.prototype.processEncryptedClose = function (encryptedData) {
        return __awaiter(this, void 0, void 0, function () {
            var decrypted, _a, payload, signature, burnerWallet, isValid, error_4;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 2, , 3]);
                        console.log('🔄 Processing encrypted close request...');
                        return [4 /*yield*/, this.decryptJSON(encryptedData)];
                    case 1:
                        decrypted = _b.sent();
                        // Step 2: Validate structure
                        if (!decrypted.payload || !decrypted.signature || !decrypted.burnerWallet) {
                            throw new Error('Invalid encrypted close payload structure');
                        }
                        _a = decrypted, payload = _a.payload, signature = _a.signature, burnerWallet = _a.burnerWallet;
                        isValid = this.verifyCloseSignature(payload, signature, burnerWallet);
                        if (!isValid) {
                            return [2 /*return*/, {
                                    payload: payload,
                                    signature: signature,
                                    burnerWallet: burnerWallet,
                                    isValid: false,
                                    error: 'Signature verification failed'
                                }];
                        }
                        console.log('✅ Encrypted close request processed successfully');
                        return [2 /*return*/, {
                                payload: payload,
                                signature: signature,
                                burnerWallet: burnerWallet,
                                isValid: true
                            }];
                    case 2:
                        error_4 = _b.sent();
                        console.error('❌ Failed to process encrypted close request:', error_4);
                        return [2 /*return*/, {
                                payload: {},
                                signature: '',
                                burnerWallet: '',
                                isValid: false,
                                error: error_4 instanceof Error ? error_4.message : 'Unknown error'
                            }];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Verify close request signature
     */
    CryptoManager.prototype.verifyCloseSignature = function (payload, signature, burnerWallet) {
        var message = JSON.stringify(payload);
        return this.verifySignature(message, signature, burnerWallet);
    };
    /**
     * Create sample encrypted close request (for testing)
     */
    CryptoManager.prototype.createSampleClosePosition = function () {
        return __awaiter(this, arguments, void 0, function (overrides) {
            var sampleClose, testPrivateKey, testWallet, message, signature, encryptedPayload;
            if (overrides === void 0) { overrides = {}; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        sampleClose = __assign({ trader: "0x742d35Cc6635C0532925a3b8FF1F4b4a5c2b9876", assetId: 0, closePercent: 100, timestamp: Date.now() }, overrides);
                        testPrivateKey = "0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
                        testWallet = new ethers_1.ethers.Wallet(testPrivateKey);
                        message = JSON.stringify(sampleClose);
                        return [4 /*yield*/, testWallet.signMessage(message)];
                    case 1:
                        signature = _a.sent();
                        encryptedPayload = {
                            payload: sampleClose,
                            signature: signature,
                            burnerWallet: testWallet.address
                        };
                        return [4 /*yield*/, this.encryptJSON(encryptedPayload)];
                    case 2: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    // ====================================================================
    // UTILITIES
    // ====================================================================
    CryptoManager.prototype.arrayBufferToBase64url = function (buf) {
        return Buffer.from(buf).toString('base64url');
    };
    CryptoManager.prototype.base64urlToArrayBuffer = function (str) {
        var buffer = Buffer.from(str, 'base64url');
        return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
    };
    /**
     * Check if crypto system is ready
     */
    CryptoManager.prototype.isReady = function () {
        return !!(this.publicKey && this.privateKey);
    };
    /**
     * Get crypto status
     */
    CryptoManager.prototype.getStatus = function () {
        return {
            hasKeys: this.isReady(),
            publicKey: this.publicKey || undefined,
            lastInitialized: this.isReady() ? new Date().toISOString() : undefined
        };
    };
    return CryptoManager;
}());
exports.CryptoManager = CryptoManager;
// Export singleton instance
exports.cryptoManager = new CryptoManager();
