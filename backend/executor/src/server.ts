import express from 'express';
import cors from 'cors';
import { 
  generateHPKEKeyPair, 
  saveHPKEKeyPair, 
  loadHPKEPublicKey, 
  loadHPKEPrivateKey,
  hpkeEncrypt, 
  hpkeDecrypt, 
  encryptJSON, 
  decryptJSON,
  initializeCrypto,
  verifyCryptoSetup,
  EncryptedData,
  HPKEKeyPair
} from './executor-botv1/cryptography';

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`📡 ${req.method} ${req.path} - ${new Date().toISOString()}`);
  next();
});

// Health check endpoint
app.get('/ping', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

// ====================================================================
// 1. KEY GENERATION ENDPOINTS
// ====================================================================

/**
 * Generate new HPKE key pair and save to files
 * POST /crypto/generate-keys
 */
app.post('/crypto/generate-keys', async (req, res) => {
  try {
    console.log('🔑 Generating new HPKE key pair...');
    
    const { forceRegenerate } = req.body;
    
    // Generate new key pair
    const keyPair = await generateHPKEKeyPair();
    
    // Save to files
    saveHPKEKeyPair(keyPair);
    
    res.json({
      success: true,
      message: 'HPKE key pair generated and saved successfully',
      publicKey: keyPair.publicKey,
      // NOTE: Don't return private key in production!
      privateKeyLength: keyPair.privateKey.length,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Key generation failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Key generation failed'
    });
  }
});

/**
 * Get current public key
 * GET /crypto/public-key
 */
app.get('/crypto/public-key', (req, res) => {
  try {
    const publicKey = loadHPKEPublicKey();
    
    res.json({
      success: true,
      publicKey,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Failed to load public key:', error);
    res.status(404).json({
      success: false,
      error: 'Public key not found. Generate keys first using POST /crypto/generate-keys'
    });
  }
});

/**
 * Initialize crypto system (generate keys if they don't exist)
 * POST /crypto/initialize
 */
app.post('/crypto/initialize', async (req, res) => {
  try {
    const { forceRegenerate = false } = req.body;
    
    const keyPair = await initializeCrypto(forceRegenerate);
    
    res.json({
      success: true,
      message: 'Crypto system initialized successfully',
      publicKey: keyPair.publicKey,
      keysExisted: !forceRegenerate,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Crypto initialization failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Crypto initialization failed'
    });
  }
});

/**
 * Verify crypto system setup
 * GET /crypto/verify
 */
app.get('/crypto/verify', (req, res) => {
  const isVerified = verifyCryptoSetup();
  
  res.json({
    success: isVerified,
    message: isVerified ? 'Crypto system is properly set up' : 'Crypto system needs initialization',
    timestamp: new Date().toISOString()
  });
});

// ====================================================================
// 2. ENCRYPTION ENDPOINTS (typically used for testing)
// ====================================================================

/**
 * Encrypt JSON data using HPKE
 * POST /crypto/encrypt
 * Body: { data: any, publicKey?: string }
 */
app.post('/crypto/encrypt', async (req, res) => {
  try {
    const { data, publicKey } = req.body;
    
    if (!data) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: data'
      });
    }
    
    // Use provided public key or load from file
    const recipientPublicKey = publicKey || loadHPKEPublicKey();
    
    console.log('🔐 Encrypting data...');
    console.log('📄 Data to encrypt:', JSON.stringify(data, null, 2));
    
    const encrypted = await encryptJSON(data, recipientPublicKey);
    
    res.json({
      success: true,
      message: 'Data encrypted successfully',
      encrypted: {
        enc: encrypted.enc,
        ct: encrypted.ct
      },
      originalDataSize: JSON.stringify(data).length,
      encryptedSize: encrypted.enc.length + encrypted.ct.length,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Encryption failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Encryption failed'
    });
  }
});

// ====================================================================
// 3. DECRYPTION ENDPOINTS 
// ====================================================================

/**
 * Decrypt HPKE encrypted data
 * POST /crypto/decrypt
 * Body: { enc: string, ct: string }
 */
app.post('/crypto/decrypt', async (req, res) => {
  try {
    const { enc, ct } = req.body;
    
    if (!enc || !ct) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: enc, ct'
      });
    }
    
    console.log('🔓 Decrypting data...');
    console.log('📦 Encrypted data size:', enc.length + ct.length, 'chars');
    
    const encryptedData: EncryptedData = { enc, ct };
    const decrypted = await decryptJSON(encryptedData);
    
    res.json({
      success: true,
      message: 'Data decrypted successfully',
      decrypted,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Decryption failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Decryption failed'
    });
  }
});

// ====================================================================
// 4. TRADE-SPECIFIC ENDPOINTS (for your perps system)
// ====================================================================

/**
 * Submit encrypted trade (main endpoint for your perps)
 * POST /trade/submit
 * Body: { enc: string, ct: string, sig?: string }
 */
app.post('/trade/submit', async (req, res) => {
  try {
    const { enc, ct, sig } = req.body;
    
    if (!enc || !ct) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: enc, ct'
      });
    }
    
    console.log('📝 Processing encrypted trade submission...');
    
    // Decrypt the trade data
    const encryptedData: EncryptedData = { enc, ct };
    const decryptedTrade = await decryptJSON(encryptedData);
    
    console.log('✅ Trade decrypted successfully:', decryptedTrade);
    
    // Here you would validate the trade structure
    // For now, just return the decrypted trade
    
    res.json({
      success: true,
      message: 'Encrypted trade processed successfully',
      tradeId: `trade_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      decryptedTrade, // Remove this in production
      signature: sig || null,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Trade submission failed:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Trade submission failed'
    });
  }
});

/**
 * Test endpoint to encrypt a sample trade
 * POST /trade/encrypt-sample
 */
app.post('/trade/encrypt-sample', async (req, res) => {
  try {
    // Sample trade data
    const sampleTrade = {
      trader: "0x742d35Cc6635C0532925a3b8FF1F4b4a5c2b9876",
      assetId: 0, // TSLA
      qty: "1000000000", // $1000 USD (in wei format)
      margin: "100000000", // $100 USDC (6 decimals)
      isLong: true,
      ts: Date.now()
    };
    
    // Override with any provided data
    const tradeData = { ...sampleTrade, ...req.body };
    
    console.log('🔐 Encrypting sample trade...');
    
    const publicKey = loadHPKEPublicKey();
    const encrypted = await encryptJSON(tradeData, publicKey);
    
    res.json({
      success: true,
      message: 'Sample trade encrypted successfully',
      originalTrade: tradeData,
      encrypted: {
        enc: encrypted.enc,
        ct: encrypted.ct
      },
      instructions: 'Use the encrypted data with POST /trade/submit',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Sample trade encryption failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Sample encryption failed'
    });
  }
});

// ====================================================================
// ERROR HANDLING & SERVER STARTUP
// ====================================================================

// Global error handler
app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('💥 Unhandled error:', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Endpoint not found: ${req.method} ${req.path}`,
    availableEndpoints: [
      'GET /ping',
      'POST /crypto/generate-keys',
      'GET /crypto/public-key', 
      'POST /crypto/initialize',
      'GET /crypto/verify',
      'POST /crypto/encrypt',
      'POST /crypto/decrypt',
      'POST /trade/submit',
      'POST /trade/encrypt-sample'
    ]
  });
});

// Start server
async function startServer() {
  try {
    console.log('🚀 Starting minimal HPKE crypto server...');
    
    // Initialize crypto system on startup
    await initializeCrypto();
    
    app.listen(PORT, () => {
      console.log(`✅ Server running on http://localhost:${PORT}`);
      console.log('📋 Available endpoints:');
      console.log('  GET  /ping                    - Health check');
      console.log('  POST /crypto/generate-keys    - Generate new HPKE keys');
      console.log('  GET  /crypto/public-key       - Get current public key');
      console.log('  POST /crypto/initialize       - Initialize crypto system');
      console.log('  GET  /crypto/verify           - Verify crypto setup');
      console.log('  POST /crypto/encrypt          - Encrypt JSON data');
      console.log('  POST /crypto/decrypt          - Decrypt encrypted data');
      console.log('  POST /trade/submit            - Submit encrypted trade');
      console.log('  POST /trade/encrypt-sample    - Encrypt sample trade');
      console.log('');
      console.log('🔑 Ready for testing with Postman!');
    });
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();