import { Aes128Gcm, CipherSuite, HkdfSha256 } from "@hpke/core";
import { DhkemX25519HkdfSha256 } from "@hpke/dhkem-x25519";
import { Chacha20Poly1305 } from "@hpke/chacha20poly1305";
import { verifyMessage, ethers } from 'ethers';
import * as fs from 'fs';

// ====================================================================
// MINIMAL CRYPTO FOR HPKE + SIGNATURE VERIFICATION
// ====================================================================

// HPKE Cipher Suite Configuration
const suite = new CipherSuite({
  kem: new DhkemX25519HkdfSha256(),
  kdf: new HkdfSha256(),
  aead: new Chacha20Poly1305(),
});

export interface EncryptedData {
  enc: string;  // base64url encoded encapsulated key
  ct: string;   // base64url encoded ciphertext
}

export interface TradePayload {
  trader: string;      // Main wallet address
  assetId: number;     // Asset ID (0-4)
  qty: string;         // Position size in USD (6 decimals)
  margin: string;      // Collateral amount in USDC (6 decimals)
  isLong: boolean;     // Direction: true = long, false = short
  timestamp: number;   // Unix timestamp
}

export interface EncryptedTradePayload {
  payload: TradePayload;
  signature: string;   // Signature from burner wallet
  burnerWallet: string; // Burner wallet address
}

export interface ClosePositionPayload {
  trader: string;      // Same trader
  assetId: number;     // Same asset
  closePercent: number; // 100 = full close, 50 = half close, etc.
  timestamp: number;   // When close was requested
}

export interface EncryptedClosePayload {
  payload: ClosePositionPayload;
  signature: string;
  burnerWallet: string;
}

export class CryptoManager {
  private privateKey: string | null = null;
  private publicKey: string | null = null;

  constructor() {
    this.loadKeys();
    console.log('🔐 Crypto manager initialized');
  }

  // ====================================================================
  // KEY MANAGEMENT
  // ====================================================================

  /**
   * Generate new HPKE key pair
   */
  async generateKeyPair(): Promise<{ publicKey: string; privateKey: string }> {
    console.log('🔑 Generating new HPKE key pair...');
    
    const keyPair = await suite.kem.generateKeyPair();
    
    const publicKeyBuffer = await suite.kem.serializePublicKey(keyPair.publicKey);
    const privateKeyBuffer = await suite.kem.serializePrivateKey(keyPair.privateKey);
    
    const publicKey = this.arrayBufferToBase64url(publicKeyBuffer);
    const privateKey = this.arrayBufferToBase64url(privateKeyBuffer);
    
    console.log('✅ HPKE key pair generated');
    return { publicKey, privateKey };
  }

  /**
   * Save key pair to files
   */
  saveKeys(publicKey: string, privateKey: string): void {
    try {
      fs.writeFileSync('.hpke-secret', privateKey);
      fs.writeFileSync('hpke-public.txt', publicKey);
      fs.chmodSync('.hpke-secret', 0o600); // Restrict private key access
      
      this.publicKey = publicKey;
      this.privateKey = privateKey;
      
      console.log('💾 HPKE keys saved successfully');
    } catch (error) {
      console.error('❌ Failed to save keys:', error);
      throw new Error('Key saving failed');
    }
  }

  /**
   * Load keys from files
   */
  private loadKeys(): void {
    try {
      if (fs.existsSync('.hpke-secret') && fs.existsSync('hpke-public.txt')) {
        this.privateKey = fs.readFileSync('.hpke-secret', 'utf8').trim();
        this.publicKey = fs.readFileSync('hpke-public.txt', 'utf8').trim();
        console.log('🔑 HPKE keys loaded from files');
      } else {
        console.log('⚠️ No existing keys found');
      }
    } catch (error) {
      console.error('❌ Failed to load keys:', error);
    }
  }

  /**
   * Initialize crypto system (generate keys if needed)
   */
  async initialize(forceRegenerate: boolean = false): Promise<string> {
    if (!forceRegenerate && this.publicKey && this.privateKey) {
      console.log('🔑 Using existing HPKE keys');
      return this.publicKey;
    }

    const { publicKey, privateKey } = await this.generateKeyPair();
    this.saveKeys(publicKey, privateKey);
    return publicKey;
  }

  /**
   * Get public key for clients
   */
  getPublicKey(): string {
    if (!this.publicKey) {
      throw new Error('Public key not available. Initialize crypto system first.');
    }
    return this.publicKey;
  }

  // ====================================================================
  // ENCRYPTION/DECRYPTION
  // ====================================================================

  /**
   * Decrypt HPKE encrypted data
   */
  async decryptData(encryptedData: EncryptedData): Promise<Uint8Array> {
    if (!this.privateKey) {
      throw new Error('Private key not available');
    }

    try {
      console.log('🔓 Decrypting HPKE data...');
      
      // Convert base64url strings back to ArrayBuffers
      const enc = new Uint8Array(Buffer.from(encryptedData.enc, 'base64url'));
      const ct = new Uint8Array(Buffer.from(encryptedData.ct, 'base64url'));
      
      // Convert private key from base64url to raw format
      const privateKeyBuffer = this.base64urlToArrayBuffer(this.privateKey);
      
      // Import the private key
      const recipientKey = await suite.kem.importKey('raw', privateKeyBuffer, true);
      
      // Perform HPKE decryption
      const plaintextBuffer = await suite.open({ recipientKey, enc }, ct);
      
      console.log('✅ HPKE decryption successful');
      return new Uint8Array(plaintextBuffer);
    } catch (error) {
      console.error('❌ HPKE decryption failed:', error);
      throw new Error('Decryption failed');
    }
  }

  /**
   * Decrypt JSON data
   */
  async decryptJSON(encryptedData: EncryptedData): Promise<any> {
    const plaintextBytes = await this.decryptData(encryptedData);
    const jsonString = new TextDecoder().decode(plaintextBytes);
    return JSON.parse(jsonString);
  }

  /**
   * Encrypt JSON data (for testing)
   */
  async encryptJSON(data: any, recipientPublicKey?: string): Promise<EncryptedData> {
    const publicKey = recipientPublicKey || this.getPublicKey();
    const jsonString = JSON.stringify(data);
    const dataBytes = new TextEncoder().encode(jsonString);
    
    try {
      console.log('🔐 Encrypting JSON data...');
      
      // Convert base64url public key back to raw format
      const publicKeyBuffer = this.base64urlToArrayBuffer(publicKey);
      
      // Import the recipient's public key
      const recipientKey = await suite.kem.importKey('raw', publicKeyBuffer, false);

      // Perform HPKE encryption
      const { enc, ct } = await suite.seal({ recipientPublicKey: recipientKey }, dataBytes);
      
      // Convert to base64url for transmission
      const encBase64 = this.arrayBufferToBase64url(enc);
      const ctBase64 = this.arrayBufferToBase64url(ct);
      
      console.log('✅ HPKE encryption successful');
      
      return {
        enc: encBase64,
        ct: ctBase64
      };
    } catch (error) {
      console.error('❌ HPKE encryption failed:', error);
      throw new Error('Encryption failed');
    }
  }

  // ====================================================================
  // SIGNATURE VERIFICATION
  // ====================================================================

  /**
   * Verify Ethereum signature
   */
  verifySignature(message: string, signature: string, expectedAddress: string): boolean {
    try {
      // Skip verification for test mode signatures
      if (signature === "TEST_MODE") {
        console.log('🧪 Test mode signature detected - skipping verification');
        return true;
      }

      console.log('🔍 Verifying signature...');
      
      const recoveredAddress = verifyMessage(message, signature);
      const isValid = recoveredAddress.toLowerCase() === expectedAddress.toLowerCase();
      
      if (isValid) {
        console.log('✅ Signature verification successful');
      } else {
        console.error(`❌ Signature verification failed: ${recoveredAddress} !== ${expectedAddress}`);
      }
      
      return isValid;
    } catch (error) {
      console.error('❌ Signature verification error:', error);
      return false;
    }
  }

  /**
   * Verify trade payload signature
   */
  verifyTradeSignature(payload: TradePayload, signature: string, burnerWallet: string): boolean {
    const message = JSON.stringify(payload);
    return this.verifySignature(message, signature, burnerWallet);
  }

  // ====================================================================
  // TRADE PROCESSING
  // ====================================================================

  /**
   * Decrypt and verify encrypted trade
   */
  async processEncryptedTrade(encryptedData: EncryptedData): Promise<{
    payload: TradePayload;
    signature: string;
    burnerWallet: string;
    isValid: boolean;
    error?: string;
  }> {
    try {
      console.log('🔄 Processing encrypted trade...');
      
      // Step 1: Decrypt the data
      const decrypted = await this.decryptJSON(encryptedData);
      
      // Step 2: Validate structure
      if (!decrypted.payload || !decrypted.signature || !decrypted.burnerWallet) {
        throw new Error('Invalid encrypted payload structure');
      }

      const { payload, signature, burnerWallet } = decrypted as EncryptedTradePayload;

      // Step 3: Verify signature
      const isValid = this.verifyTradeSignature(payload, signature, burnerWallet);

      if (!isValid) {
        return {
          payload,
          signature,
          burnerWallet,
          isValid: false,
          error: 'Signature verification failed'
        };
      }

      console.log('✅ Encrypted trade processed successfully');
      return {
        payload,
        signature,
        burnerWallet,
        isValid: true
      };

    } catch (error) {
      console.error('❌ Failed to process encrypted trade:', error);
      
      return {
        payload: {} as TradePayload,
        signature: '',
        burnerWallet: '',
        isValid: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // ====================================================================
  // TESTING HELPERS
  // ====================================================================

  /**
   * Create sample encrypted trade (for testing)
   */
  async createSampleEncryptedTrade(overrides: Partial<TradePayload> = {}): Promise<EncryptedData> {
    const sampleTrade: TradePayload = {
      trader: "0x742d35Cc6635C0532925a3b8FF1F4b4a5c2b9876",
      assetId: 0, // TSLA
      qty: "1000000000", // $1000 USD (6 decimals)
      margin: "100000000", // $100 USDC (6 decimals)
      isLong: true,
      timestamp: Date.now(),
      ...overrides
    };

    // Create a test wallet for signing
    const testPrivateKey = "0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    const testWallet = new ethers.Wallet(testPrivateKey);
    
    // Sign the trade payload
    const message = JSON.stringify(sampleTrade);
    const signature = await testWallet.signMessage(message);

    const encryptedPayload: EncryptedTradePayload = {
      payload: sampleTrade,
      signature: signature,
      burnerWallet: testWallet.address // Use the actual test wallet address
    };

    return await this.encryptJSON(encryptedPayload);
  }

  /**
   * Process encrypted close request
   */
  async processEncryptedClose(encryptedData: EncryptedData): Promise<{
    payload: ClosePositionPayload;
    signature: string;
    burnerWallet: string;
    isValid: boolean;
    error?: string;
  }> {
    try {
      console.log('🔄 Processing encrypted close request...');
      
      // Step 1: Decrypt the data
      const decrypted = await this.decryptJSON(encryptedData);
      
      // Step 2: Validate structure
      if (!decrypted.payload || !decrypted.signature || !decrypted.burnerWallet) {
        throw new Error('Invalid encrypted close payload structure');
      }

      const { payload, signature, burnerWallet } = decrypted as EncryptedClosePayload;

      // Step 3: Verify signature
      const isValid = this.verifyCloseSignature(payload, signature, burnerWallet);

      if (!isValid) {
        return {
          payload,
          signature,
          burnerWallet,
          isValid: false,
          error: 'Signature verification failed'
        };
      }

      console.log('✅ Encrypted close request processed successfully');
      return {
        payload,
        signature,
        burnerWallet,
        isValid: true
      };

    } catch (error) {
      console.error('❌ Failed to process encrypted close request:', error);
      
      return {
        payload: {} as ClosePositionPayload,
        signature: '',
        burnerWallet: '',
        isValid: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Verify close request signature
   */
  verifyCloseSignature(payload: ClosePositionPayload, signature: string, burnerWallet: string): boolean {
    const message = JSON.stringify(payload);
    return this.verifySignature(message, signature, burnerWallet);
  }

  /**
   * Create sample encrypted close request (for testing)
   */
  async createSampleClosePosition(overrides: Partial<ClosePositionPayload> = {}): Promise<EncryptedData> {
    const sampleClose: ClosePositionPayload = {
      trader: "0x742d35Cc6635C0532925a3b8FF1F4b4a5c2b9876",
      assetId: 0,
      closePercent: 100, // Full close by default
      timestamp: Date.now(),
      ...overrides
    };

  // Create a test wallet for signing
  const testPrivateKey = "0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
  const testWallet = new ethers.Wallet(testPrivateKey);
  
  // Sign the close request
  const message = JSON.stringify(sampleClose);
  const signature = await testWallet.signMessage(message);

  const encryptedPayload: EncryptedClosePayload = {
    payload: sampleClose,
    signature: signature,
    burnerWallet: testWallet.address
  };

  return await this.encryptJSON(encryptedPayload);
}

  // ====================================================================
  // UTILITIES
  // ====================================================================

  private arrayBufferToBase64url(buf: ArrayBuffer): string {
    return Buffer.from(buf).toString('base64url');
  }

  private base64urlToArrayBuffer(str: string): ArrayBuffer {
    const buffer = Buffer.from(str, 'base64url');
    return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  }

  /**
   * Check if crypto system is ready
   */
  isReady(): boolean {
    return !!(this.publicKey && this.privateKey);
  }

  /**
   * Get crypto status
   */
  getStatus(): {
    hasKeys: boolean;
    publicKey?: string;
    lastInitialized?: string;
  } {
    return {
      hasKeys: this.isReady(),
      publicKey: this.publicKey || undefined,
      lastInitialized: this.isReady() ? new Date().toISOString() : undefined
    };
  }
}

// Export singleton instance
export const cryptoManager = new CryptoManager();