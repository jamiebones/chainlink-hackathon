"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var express_1 = __importDefault(require("express"));
var cors_1 = __importDefault(require("cors"));
var core_1 = require("@hpke/core");
var dhkem_x25519_1 = require("@hpke/dhkem-x25519");
var chacha20poly1305_1 = require("@hpke/chacha20poly1305");
var fs = __importStar(require("fs"));
var suite = new core_1.CipherSuite({
    kem: new dhkem_x25519_1.DhkemX25519HkdfSha256(),
    kdf: new core_1.HkdfSha256(),
    aead: new chacha20poly1305_1.Chacha20Poly1305(),
});
function arrayBufferToBase64url(buf) {
    return Buffer.from(buf).toString('base64url');
}
function arrayBufferToBase64(buf) {
    return Buffer.from(buf).toString('base64');
}
function base64ToUint8Array(b64) {
    return new Uint8Array(Buffer.from(b64, 'base64'));
}
var recipientPrivKey;
var recipientPubKey;
(function () { return __awaiter(void 0, void 0, void 0, function () {
    var rkp, pubKeyBuf, privKeyBuf, pubKey, privKey;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, suite.kem.generateKeyPair()];
            case 1:
                rkp = _a.sent();
                recipientPrivKey = rkp.privateKey;
                recipientPubKey = rkp.publicKey;
                return [4 /*yield*/, suite.kem.serializePublicKey(rkp.publicKey)];
            case 2:
                pubKeyBuf = _a.sent();
                return [4 /*yield*/, suite.kem.serializePrivateKey(rkp.privateKey)];
            case 3:
                privKeyBuf = _a.sent();
                pubKey = arrayBufferToBase64url(pubKeyBuf);
                privKey = arrayBufferToBase64url(privKeyBuf);
                fs.writeFileSync('.hpke-secret', privKey);
                fs.writeFileSync('../../../frontend-V1/public-key/hpke-key.txt', pubKey);
                console.log('HPKE keypair generated & saved.');
                return [2 /*return*/];
        }
    });
}); })();
var app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json({ limit: '512kb' }));
app.post('/submit', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, enc, ctc, encBuf, encArrayBuffer, ctBuf, ctArrayBuffer, recipient, pt, e_1;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 3, , 4]);
                console.log("the request is ", req.body);
                _a = req.body, enc = _a.enc, ctc = _a.ctc;
                console.log("enc is ", enc);
                console.log("ctc is ", ctc);
                encBuf = Buffer.from(enc, 'base64');
                encArrayBuffer = encBuf.buffer.slice(encBuf.byteOffset, encBuf.byteOffset + encBuf.byteLength);
                console.log("encArrayBuffer is ", encArrayBuffer);
                ctBuf = Buffer.from(ctc, 'base64');
                ctArrayBuffer = ctBuf.buffer.slice(ctBuf.byteOffset, ctBuf.byteOffset + ctBuf.byteLength);
                console.log("ctArrayBuffer is ", ctArrayBuffer);
                if (!recipientPrivKey)
                    throw new Error('HPKE private key not loaded!');
                return [4 /*yield*/, suite.createRecipientContext({
                        recipientKey: recipientPrivKey,
                        enc: encArrayBuffer,
                    })];
            case 1:
                recipient = _b.sent();
                return [4 /*yield*/, recipient.open(ctArrayBuffer)];
            case 2:
                pt = _b.sent();
                console.log(new TextDecoder().decode(pt));
                // const pt = await recipient.open(ctBytes);
                // const textFetched = new TextDecoder().decode(pt);
                // console.log('Decrypted payload (JSON):', textFetched);
                // Extract and verify signature
                // const { payload, sig } = JSON.parse(textFetched);
                // const recovered = verifyMessage(JSON.stringify(payload), sig);
                // if (recovered.toLowerCase() !== payload.trader.toLowerCase()) {
                //   throw new Error('bad signature');
                // }
                // console.log('✅ Burner wallet + HPKE worked! Trade:', payload);
                res.json({ ok: true });
                return [3 /*break*/, 4];
            case 3:
                e_1 = _b.sent();
                console.error('❌ Error:', e_1);
                res.status(400).json({ error: 'decrypt, parse, or sig failed' });
                return [3 /*break*/, 4];
            case 4: return [2 /*return*/];
        }
    });
}); });
app.listen(8080, function () { return console.log('🟢 Listening on :8080'); });
