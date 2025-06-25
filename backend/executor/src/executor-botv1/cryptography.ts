import { Aes128Gcm, CipherSuite, HkdfSha256 } from "@hpke/core";
import { DhkemX25519HkdfSha256 } from "@hpke/dhkem-x25519";
import { Chacha20Poly1305 } from "@hpke/chacha20poly1305";
import * as fs from 'fs';
import * as path from 'path';

// HPKE Cipher Suite Configuration
const suite = new CipherSuite({
  kem: new DhkemX25519HkdfSha256(),  // Key Encapsulation Mechanism using X25519
  kdf: new HkdfSha256(),             // Key Derivation Function using SHA256
  aead: new Chacha20Poly1305(),      // Authenticated Encryption with Associated Data
});

// File paths for key storage
const PRIVATE_KEY_PATH = '.hpke-secret';
const PUBLIC_KEY_PATH = 'hpke-public.txt';

/**
 * Utility function to convert ArrayBuffer to base64url encoding
 * @param buf - ArrayBuffer to convert
 * @returns base64url encoded string
 */
function arrayBufferToBase64url(buf: ArrayBuffer): string {
  return Buffer.from(buf).toString('base64url');
}

/**
 * Utility function to convert base64url string back to ArrayBuffer
 * @param str - base64url encoded string
 * @returns ArrayBuffer
 */
function base64urlToArrayBuffer(str: string): ArrayBuffer {
  console.log('🔧 Converting base64url to ArrayBuffer:', str);
  
  // Use Buffer.from() but convert to Uint8Array first
  const buffer = Buffer.from(str, 'base64url');
  const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  
  console.log('🔧 Resulting buffer length:', arrayBuffer.byteLength);
  return arrayBuffer;
}

/**
 * Interface for HPKE key pair
 */
export interface HPKEKeyPair {
  publicKey: string;    // base64url encoded public key
  privateKey: string;   // base64url encoded private key
}

/**
 * Interface for encrypted data
 */
export interface EncryptedData {
  enc: string;  // base64url encoded encapsulated key
  ct: string;   // base64url encoded ciphertext
}

/**
 * Interface for encrypted trade payload
 */
export interface EncryptedTradePayload extends EncryptedData {
  sig: string;  // Signature (if included in the payload)
}

/**
 * Generate a new HPKE key pair
 * @returns Promise<HPKEKeyPair> - Generated key pair
 */
export async function generateHPKEKeyPair(): Promise<HPKEKeyPair> {
  try {
    console.log('🔑 Generating new HPKE key pair...');
    
    // Generate key pair using the cipher suite
    const keyPair = await suite.kem.generateKeyPair();
    
    // Serialize keys to raw format
    const publicKeyBuffer = await suite.kem.serializePublicKey(keyPair.publicKey);
    const privateKeyBuffer = await suite.kem.serializePrivateKey(keyPair.privateKey);
    
    // Convert to base64url strings for storage/transmission
    const publicKey = arrayBufferToBase64url(publicKeyBuffer);
    const privateKey = arrayBufferToBase64url(privateKeyBuffer);
    
    console.log('✅ HPKE key pair generated successfully');
    console.log(`📋 Public key: ${publicKey}`);
    
    return {
      publicKey,
      privateKey
    };
  } catch (error) {
    console.error('❌ Failed to generate HPKE key pair:', error);
    throw new Error('Key pair generation failed');
  }
}

/**
 * Save HPKE key pair to files
 * @param keyPair - Key pair to save
 * @param publicKeyPath - Optional custom path for public key (default: hpke-public.txt)
 * @param privateKeyPath - Optional custom path for private key (default: .hpke-secret)
 */
export function saveHPKEKeyPair(
  keyPair: HPKEKeyPair, 
  publicKeyPath: string = PUBLIC_KEY_PATH,
  privateKeyPath: string = PRIVATE_KEY_PATH
): void {
  try {
    console.log('💾 Saving HPKE key pair to files...');
    
    // Save private key (keep it secret!)
    fs.writeFileSync(privateKeyPath, keyPair.privateKey);
    console.log(`🔒 Private key saved to: ${privateKeyPath}`);
    
    // Save public key (can be shared)
    fs.writeFileSync(publicKeyPath, keyPair.publicKey);
    console.log(`🔓 Public key saved to: ${publicKeyPath}`);
    
    // Set restrictive permissions on private key file
    fs.chmodSync(privateKeyPath, 0o600); // Owner read/write only
    
    console.log('✅ HPKE key pair saved successfully');
  } catch (error) {
    console.error('❌ Failed to save HPKE key pair:', error);
    throw new Error('Key pair saving failed');
  }
}

/**
 * Load HPKE private key from file
 * @param privateKeyPath - Path to private key file
 * @returns string - base64url encoded private key
 */
export function loadHPKEPrivateKey(privateKeyPath: string = PRIVATE_KEY_PATH): string {
  try {
    if (!fs.existsSync(privateKeyPath)) {
      throw new Error(`Private key file not found: ${privateKeyPath}`);
    }
    
    const privateKey = fs.readFileSync(privateKeyPath, 'utf8').trim();
    console.log('🔑 HPKE private key loaded successfully');
    return privateKey;
  } catch (error) {
    console.error('❌ Failed to load HPKE private key:', error);
    throw new Error('Private key loading failed');
  }
}

/**
 * Load HPKE public key from file
 * @param publicKeyPath - Path to public key file
 * @returns string - base64url encoded public key
 */
export function loadHPKEPublicKey(publicKeyPath: string = PUBLIC_KEY_PATH): string {
  try {
    if (!fs.existsSync(publicKeyPath)) {
      throw new Error(`Public key file not found: ${publicKeyPath}`);
    }
    
    const publicKey = fs.readFileSync(publicKeyPath, 'utf8').trim();
    console.log('🔓 HPKE public key loaded successfully');
    return publicKey;
  } catch (error) {
    console.error('❌ Failed to load HPKE public key:', error);
    throw new Error('Public key loading failed');
  }
}

/**
 * Encrypt data using HPKE (typically used by client/frontend)
 * @param data - Data to encrypt (as Uint8Array)
 * @param recipientPublicKey - base64url encoded public key of recipient
 * @returns Promise<EncryptedData> - Encrypted data with encapsulated key
 */
export async function hpkeEncrypt(
  data: Uint8Array, 
  recipientPublicKey: string
): Promise<EncryptedData> {
  try {
    console.log('🔐 Encrypting data with HPKE...');
    console.log('🔑 Input public key:', recipientPublicKey);
    console.log('🔑 Input key length:', recipientPublicKey.length);
    
    // Convert base64url public key back to raw format
    const publicKeyBuffer = base64urlToArrayBuffer(recipientPublicKey);
    console.log('🔑 Converted buffer length:', publicKeyBuffer.byteLength);
    console.log('🔑 Buffer contents:', new Uint8Array(publicKeyBuffer));
    
    // Import the recipient's public key
    const recipientKey = await suite.kem.importKey('raw', publicKeyBuffer, false);

    // Perform HPKE encryption
    const { enc, ct } = await suite.seal({ recipientPublicKey: recipientKey }, data);
    
    // Convert to base64url for transmission
    const encBase64 = arrayBufferToBase64url(enc);
    const ctBase64 = arrayBufferToBase64url(ct);
    
    console.log('✅ Data encrypted successfully');
    console.log(`📦 Encapsulated key length: ${encBase64.length} chars`);
    console.log(`📦 Ciphertext length: ${ctBase64.length} chars`);
    
    return {
      enc: encBase64,
      ct: ctBase64
    };
  } catch (error) {
    console.error('❌ HPKE encryption failed:', error);
    throw new Error('Encryption failed');
  }
}

/**
 * Decrypt data using HPKE (used by executor/server)
 * @param encryptedData - Encrypted data object
 * @param privateKey - Optional private key (if not provided, loads from file)
 * @returns Promise<Uint8Array> - Decrypted plaintext data
 */
export async function hpkeDecrypt(
  encryptedData: EncryptedData,
  privateKey?: string
): Promise<Uint8Array> {
  try {
    console.log('🔓 Decrypting data with HPKE...');
    
    // Load private key if not provided
    const privKey = privateKey || loadHPKEPrivateKey();
    
    // Convert base64url strings back to ArrayBuffers
    const enc = new Uint8Array(Buffer.from(encryptedData.enc, 'base64url'));
    const ct = new Uint8Array(Buffer.from(encryptedData.ct, 'base64url'));
    
    // Convert private key from base64url to raw format
    const privateKeyBuffer = base64urlToArrayBuffer(privKey);
    
    // Import the private key
    const recipientKey = await suite.kem.importKey('raw', privateKeyBuffer, true);
    
    // Perform HPKE decryption
    const plaintextBuffer = await suite.open({ recipientKey, enc }, ct);
    
    console.log('✅ Data decrypted successfully');
    console.log(`📄 Plaintext length: ${plaintextBuffer.byteLength} bytes`);
    
    return new Uint8Array(plaintextBuffer);
  } catch (error) {
    console.error('❌ HPKE decryption failed:', error);
    throw new Error('Decryption failed');
  }
}

/**
 * Convenience function to encrypt a JSON object
 * @param jsonData - Any serializable JavaScript object
 * @param recipientPublicKey - base64url encoded public key
 * @returns Promise<EncryptedData> - Encrypted data
 */
export async function encryptJSON(
  jsonData: any, 
  recipientPublicKey: string
): Promise<EncryptedData> {
  const jsonString = JSON.stringify(jsonData);
  const dataBytes = new TextEncoder().encode(jsonString);
  return await hpkeEncrypt(dataBytes, recipientPublicKey);
}

/**
 * Convenience function to decrypt data back to JSON object
 * @param encryptedData - Encrypted data object
 * @param privateKey - Optional private key
 * @returns Promise<any> - Decrypted JSON object
 */
export async function decryptJSON(
  encryptedData: EncryptedData,
  privateKey?: string
): Promise<any> {
  const plaintextBytes = await hpkeDecrypt(encryptedData, privateKey);
  const jsonString = new TextDecoder().decode(plaintextBytes);
  return JSON.parse(jsonString);
}

/**
 * Initialize crypto system - generate keys if they don't exist
 * @param forceRegenerate - Whether to regenerate keys even if they exist
 * @returns Promise<HPKEKeyPair> - The current key pair
 */
export async function initializeCrypto(forceRegenerate: boolean = false): Promise<HPKEKeyPair> {
  try {
    console.log('🚀 Initializing crypto system...');
    
    // Check if keys already exist
    const privateKeyExists = fs.existsSync(PRIVATE_KEY_PATH);
    const publicKeyExists = fs.existsSync(PUBLIC_KEY_PATH);
    
    if (!forceRegenerate && privateKeyExists && publicKeyExists) {
      console.log('🔑 Using existing HPKE keys');
      return {
        publicKey: loadHPKEPublicKey(),
        privateKey: loadHPKEPrivateKey()
      };
    }
    
    // Generate new keys
    console.log('🔄 Generating new HPKE keys...');
    const keyPair = await generateHPKEKeyPair();
    saveHPKEKeyPair(keyPair);
    
    return keyPair;
  } catch (error) {
    console.error('❌ Crypto initialization failed:', error);
    throw new Error('Crypto system initialization failed');
  }
}

/**
 * Verify that the crypto system is properly set up
 * @returns boolean - Whether the crypto system is ready
 */
export function verifyCryptoSetup(): boolean {
  try {
    const privateKeyExists = fs.existsSync(PRIVATE_KEY_PATH);
    const publicKeyExists = fs.existsSync(PUBLIC_KEY_PATH);
    
    if (!privateKeyExists || !publicKeyExists) {
      console.warn('⚠️ HPKE keys not found');
      return false;
    }
    
    // Try to load keys to verify they're valid
    loadHPKEPrivateKey();
    loadHPKEPublicKey();
    
    console.log('✅ Crypto system verified');
    return true;
  } catch (error) {
    console.error('❌ Crypto system verification failed:', error);
    return false;
  }
}

// Export the cipher suite for advanced usage
export { suite };