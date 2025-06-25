import express from 'express';
import cors from 'cors';
import { 
  generateHPKEKeyPair, 
  saveHPKEKeyPair, 
  loadHPKEPublicKey, 
  initializeCrypto,
  verifyCryptoSetup,
  encryptJSON,
  EncryptedData
} from './cryptography';
import { tradeExecutor, TradePayload } from './executor';
import { balanceManager } from './balance-manager';
import { positionManager } from './position-manager';
import { poseidonMerkleTree } from './merkle-tree';
import { feeCalculator } from './fee-calculator';
import { tradeValidator } from './trade-validator';
import { dataStore } from './data-store';

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`📡 ${req.method} ${req.path} - ${new Date().toISOString()}`);
  if (req.body && Object.keys(req.body).length > 0) {
    console.log(`📄 Body:`, JSON.stringify(req.body, null, 2));
  }
  next();
});

// ====================================================================
// 1. SYSTEM HEALTH & SETUP
// ====================================================================

/**
 * Health check endpoint
 */
app.get('/ping', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Private Perps Executor is running',
    timestamp: new Date().toISOString()
  });
});

/**
 * System status endpoint
 */
app.get('/status', async (req, res) => {
  try {
    const stats = await tradeExecutor.getStats();
    const cryptoSetup = verifyCryptoSetup();
    
    res.json({
      status: 'healthy',
      cryptoSetup,
      executor: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get system status',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Initialize crypto system
 */
app.post('/setup/crypto', async (req, res) => {
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
 * Get public key for client encryption
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
      error: 'Public key not found. Initialize crypto system first using POST /setup/crypto'
    });
  }
});

// ====================================================================
// 2. BALANCE MANAGEMENT
// ====================================================================

/**
 * User deposit collateral
 */
app.post('/balance/deposit', async (req, res) => {
  try {
    const { user, amount } = req.body;
    
    if (!user || !amount) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: user, amount'
      });
    }

    const amountBigInt = BigInt(amount);
    const txHash = await tradeExecutor.depositCollateral(user, amountBigInt);
    
    const newBalance = balanceManager.getBalance(user);
    
    res.json({
      success: true,
      message: 'Deposit processed successfully',
      txHash,
      balance: {
        total: newBalance.total.toString(),
        available: newBalance.available.toString(),
        locked: newBalance.locked.toString(),
        lastUpdate: newBalance.lastUpdate
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Deposit failed:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Deposit failed'
    });
  }
});

/**
 * User withdraw collateral
 */
app.post('/balance/withdraw', async (req, res) => {
  try {
    const { user, amount } = req.body;
    
    if (!user || !amount) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: user, amount'
      });
    }

    const amountBigInt = BigInt(amount);
    const txHash = await tradeExecutor.withdrawCollateral(user, amountBigInt);
    
    const newBalance = balanceManager.getBalance(user);
    
    res.json({
      success: true,
      message: 'Withdrawal processed successfully',
      txHash,
      balance: {
        total: newBalance.total.toString(),
        available: newBalance.available.toString(),
        locked: newBalance.locked.toString(),
        lastUpdate: newBalance.lastUpdate
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Withdrawal failed:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Withdrawal failed'
    });
  }
});

/**
 * Get user balance
 */
app.get('/balance/:user', (req, res) => {
  try {
    const { user } = req.params;
    const balance = balanceManager.getBalance(user);
    
    res.json({
      success: true,
      user,
      balance: {
        total: balance.total.toString(),
        available: balance.available.toString(),
        locked: balance.locked.toString(),
        lastUpdate: balance.lastUpdate
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch balance'
    });
  }
});

/**
 * Get all balances
 */
app.get('/balance/all', (req, res) => {
  try {
    const allBalances = balanceManager.getAllBalances();
    const stats = balanceManager.getStats();
    
    res.json({
      success: true,
      balances: allBalances.map(({ trader, balance }) => {
        // Get the full balance object which includes lastUpdate
        const fullBalance = balanceManager.getBalance(trader);
        return {
          trader,
          balance: {
            total: balance.total.toString(),
            available: balance.available.toString(),
            locked: balance.locked.toString(),
            lastUpdate: fullBalance.lastUpdate
          }
        };
      }),
      stats: {
        totalUsers: stats.totalUsers,
        totalDeposited: stats.totalDeposited.toString(),
        totalAvailable: stats.totalAvailable.toString(),
        totalLocked: stats.totalLocked.toString()
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch all balances'
    });
  }
});

// ====================================================================
// 3. TRADE SUBMISSION
// ====================================================================

/**
 * Submit encrypted trade (main endpoint)
 */
app.post('/trade/submit', async (req, res) => {
  try {
    const { enc, ct } = req.body;
    
    if (!enc || !ct) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: enc, ct'
      });
    }
    
    console.log('📝 Processing encrypted trade submission...');
    
    const encryptedData: EncryptedData = { enc, ct };
    const processedTrade = await tradeExecutor.processEncryptedTrade(encryptedData);
    
    res.json({
      success: true,
      message: 'Trade processed successfully',
      trade: {
        tradeId: processedTrade.tradeId,
        isValid: processedTrade.isValid,
        trader: processedTrade.payload?.trader,
        assetId: processedTrade.payload?.assetId,
        isLong: processedTrade.payload?.isLong,
        qty: processedTrade.payload?.qty,
        margin: processedTrade.payload?.margin,
        timestamp: processedTrade.payload?.timestamp,
        errors: processedTrade.errors
      },
      stats: {
        pendingTrades: tradeExecutor.getPendingTrades().length
      },
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
 * Create and encrypt sample trade (for testing)
 */
app.post('/trade/encrypt-sample', async (req, res) => {
  try {
    // Sample trade data
    const sampleTrade: TradePayload = {
      trader: "0x742d35Cc6635C0532925a3b8FF1F4b4a5c2b9876",
      assetId: 0, // TSLA
      qty: "1000000000", // $1000 USD (6 decimals)
      margin: "100000000", // $100 USDC (6 decimals)
      isLong: true,
      timestamp: Date.now()
    };
    
    // Override with any provided data
    const tradeData = { ...sampleTrade, ...req.body };
    
    // Mock signature data
    const encryptedPayload = {
      payload: tradeData,
      signature: "0x" + "a".repeat(130), // Mock signature
      burnerWallet: "0x742d35Cc6635C0532925a3b8FF1F4b4a5c2b9876" // Mock burner wallet
    };
    
    console.log('🔐 Encrypting sample trade...');
    
    const publicKey = loadHPKEPublicKey();
    const encrypted = await encryptJSON(encryptedPayload, publicKey);
    
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
// 4. TRADE & BATCH QUERIES
// ====================================================================

/**
 * Get pending trades
 */
app.get('/trade/pending', (req, res) => {
  try {
    const pendingTrades = tradeExecutor.getPendingTrades();
    
    res.json({
      success: true,
      pendingTrades: pendingTrades.map(trade => ({
        tradeId: trade.tradeId,
        trader: trade.trader,
        assetId: trade.assetId,
        isLong: trade.isLong,
        qty: trade.qty.toString(),
        margin: trade.margin.toString(),
        isValid: trade.isValid,
        errors: trade.errors,
        timestamp: trade.timestamp
      })),
      stats: {
        total: pendingTrades.length,
        valid: pendingTrades.filter(t => t.isValid).length,
        invalid: pendingTrades.filter(t => !t.isValid).length
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch pending trades'
    });
  }
});

/**
 * Get processed trades
 */
app.get('/trade/processed', (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const processedTrades = tradeExecutor.getProcessedTrades(limit);
    
    res.json({
      success: true,
      trades: processedTrades.map(trade => ({
        tradeId: trade.tradeId,
        trader: trade.trader,
        assetId: trade.assetId,
        isLong: trade.isLong,
        qty: trade.qty.toString(),
        margin: trade.margin.toString(),
        isValid: trade.isValid,
        errors: trade.errors,
        timestamp: trade.timestamp,
        processedAt: trade.processedAt,
        batchId: trade.batchId
      })),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch processed trades'
    });
  }
});

/**
 * Get batch history
 */
app.get('/batch/history', (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const batchHistory = tradeExecutor.getBatchHistory(limit);
    
    res.json({
      success: true,
      batches: batchHistory.map(batch => ({
        batchId: batch.batchId,
        processedTrades: batch.processedTrades,
        assetIds: batch.assetIds,
        netDeltas: batch.netDeltas.map((d: bigint) => d.toString()),
        marginDeltas: batch.marginDeltas.map((d: bigint) => d.toString()),
        totalFees: batch.totalFees.toString(),
        blockNumber: batch.blockNumber,
        txHash: batch.txHash,
        success: batch.success,
        error: batch.error,
        timestamp: batch.timestamp
      })),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch batch history'
    });
  }
});

/**
 * Get latest batch status
 */
app.get('/batch/latest', (req, res) => {
  try {
    const latestBatch = tradeExecutor.getLatestBatch();
    
    if (!latestBatch) {
      return res.json({
        success: true,
        message: 'No batches processed yet',
        timestamp: new Date().toISOString()
      });
    }
    
    res.json({
      success: true,
      batch: {
        batchId: latestBatch.batchId,
        processedTrades: latestBatch.processedTrades,
        assetIds: latestBatch.assetIds,
        netDeltas: latestBatch.netDeltas.map((d: bigint) => d.toString()),
        marginDeltas: latestBatch.marginDeltas.map((d: bigint) => d.toString()),
        totalFees: latestBatch.totalFees.toString(),
        blockNumber: latestBatch.blockNumber,
        txHash: latestBatch.txHash,
        success: latestBatch.success,
        error: latestBatch.error,
        timestamp: latestBatch.timestamp
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch latest batch'
    });
  }
});

// ====================================================================
// 5. POSITION QUERIES
// ====================================================================

/**
 * Get user positions
 */
app.get('/position/:user', async (req, res) => {
  try {
    const { user } = req.params;
    const positions = positionManager.getTraderPositions(user);
    
    const positionSummaries = await Promise.all(
      positions.map(async (pos) => {
        try {
          const summary = await positionManager.getPositionSummary(pos.trader, pos.assetId);
          return summary;
        } catch (error) {
          console.error(`Error getting summary for ${pos.trader}-${pos.assetId}:`, error);
          return {
            trader: pos.trader,
            assetId: pos.assetId,
            size: pos.size,
            margin: pos.margin,
            entryPrice: pos.entryPrice,
            currentPrice: 0n,
            isLong: pos.size > 0n,
            leverage: 0,
            pnl: 0n,
            pnlPercentage: 0,
            liquidationPrice: 0n,
            marginRatio: 0
          };
        }
      })
    );
    
    res.json({
      success: true,
      user,
      positions: positionSummaries.map(pos => pos ? ({
        assetId: pos.assetId,
        size: pos.size.toString(),
        margin: pos.margin.toString(),
        entryPrice: pos.entryPrice.toString(),
        currentPrice: pos.currentPrice.toString(),
        isLong: pos.isLong,
        leverage: pos.leverage,
        pnl: pos.pnl.toString(),
        pnlPercentage: pos.pnlPercentage,
        liquidationPrice: pos.liquidationPrice.toString(),
        marginRatio: pos.marginRatio
      }) : null).filter((pos): pos is NonNullable<typeof pos> => pos !== null),
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Failed to fetch positions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch positions'
    });
  }
});

/**
 * Get positions for an asset
 */
app.get('/asset/:assetId/positions', async (req, res) => {
  try {
    const assetId = parseInt(req.params.assetId);
    const positions = positionManager.getAssetPositions(assetId);
    const assetSummary = await positionManager.getAssetSummary(assetId);
    
    res.json({
      success: true,
      assetId,
      summary: {
        totalLongPositions: assetSummary.totalLongPositions.toString(),
        totalShortPositions: assetSummary.totalShortPositions.toString(),
        netExposure: assetSummary.netExposure.toString(),
        totalMargin: assetSummary.totalMargin.toString(),
        positionCount: assetSummary.positionCount,
        currentPrice: assetSummary.currentPrice.toString()
      },
      positions: positions.map(pos => ({
        trader: pos.trader,
        size: pos.size.toString(),
        margin: pos.margin.toString(),
        isLong: pos.size > 0n,
        entryPrice: pos.entryPrice.toString(),
        lastUpdate: pos.lastUpdate
      })),
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Failed to fetch asset positions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch asset positions'
    });
  }
});

/**
 * Get all positions
 */
app.get('/position/all', (req, res) => {
  try {
    const allPositions = positionManager.getAllPositions();
    
    res.json({
      success: true,
      positions: allPositions.map(pos => ({
        trader: pos.trader,
        assetId: pos.assetId,
        size: pos.size.toString(),
        margin: pos.margin.toString(),
        entryPrice: pos.entryPrice.toString(),
        entryFunding: pos.entryFunding.toString(),
        isLong: pos.size > 0n,
        lastUpdate: pos.lastUpdate
      })),
      count: allPositions.length,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch all positions'
    });
  }
});

// ====================================================================
// 6. MERKLE TREE QUERIES
// ====================================================================

/**
 * Get merkle tree stats
 */
app.get('/merkle/stats', (req, res) => {
  try {
    const stats = poseidonMerkleTree.getStats();
    
    res.json({
      success: true,
      merkleTree: stats,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch merkle tree stats'
    });
  }
});

/**
 * Generate merkle proof for position
 */
app.get('/merkle/proof/:trader/:assetId', async (req, res) => {
  try {
    const { trader, assetId } = req.params;
    const proof = await poseidonMerkleTree.generateProof(trader, parseInt(assetId));
    
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
        siblings: proof.siblings.map((s: bigint) => s.toString()),
        pathIndices: proof.pathIndices
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to generate merkle proof'
    });
  }
});

// ====================================================================
// 7. FEE CALCULATION QUERIES
// ====================================================================

/**
 * Calculate fees for position size
 */
app.post('/fees/calculate', async (req, res) => {
  try {
    const { positionSize, margin } = req.body;
    
    if (!positionSize || !margin) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: positionSize, margin'
      });
    }
    
    const positionSizeBigInt = BigInt(positionSize);
    const marginBigInt = BigInt(margin);
    
    const feeBreakdown = await feeCalculator.calculateOpenPositionFees(
      positionSizeBigInt,
      marginBigInt
    );
    
    res.json({
      success: true,
      fees: {
        openingFee: feeBreakdown.openingFee.toString(),
        totalFees: feeBreakdown.totalFees.toString(),
        netMargin: feeBreakdown.netMargin.toString()
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Failed to calculate fees:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Fee calculation failed'
    });
  }
});

/**
 * Get fee summary
 */
app.get('/fees/summary', async (req, res) => {
  try {
    const summary = await feeCalculator.getFeeSummary();
    
    res.json({
      success: true,
      feeSummary: summary,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch fee summary'
    });
  }
});

// ====================================================================
// 8. TRADE VALIDATION
// ====================================================================

/**
 * Validate a trade without processing it
 */
app.post('/trade/validate', async (req, res) => {
  try {
    const tradePayload: TradePayload = req.body;
    
    if (!tradePayload.trader || typeof tradePayload.assetId !== 'number' || 
        !tradePayload.qty || !tradePayload.margin || 
        typeof tradePayload.isLong !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'Invalid trade payload format'
      });
    }
    
    const validationResult = await tradeValidator.validateTrade(tradePayload);
    
    res.json({
      success: true,
      validation: validationResult,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Trade validation failed:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Trade validation failed'
    });
  }
});

/**
 * Get validation configuration
 */
app.get('/trade/validation-config', async (req, res) => {
  try {
    const config = await tradeValidator.getValidationConfig();
    
    res.json({
      success: true,
      validationConfig: config,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch validation config'
    });
  }
});

// ====================================================================
// 9. ADMIN & TESTING ENDPOINTS
// ====================================================================

/**
 * Clear all data (testing only)
 */
app.post('/admin/clear', async (req, res) => {
  try {
    await tradeExecutor.clear();
    
    res.json({
      success: true,
      message: 'All executor data cleared',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to clear data'
    });
  }
});

/**
 * Verify system integrity
 */
app.get('/admin/verify', async (req, res) => {
  try {
    const integrity = await tradeExecutor.verifyIntegrity();
    
    res.json({
      success: true,
      integrity,
      message: integrity ? 'System integrity check passed' : 'System integrity check failed',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Integrity check failed'
    });
  }
});

/**
 * Get database stats
 */
app.get('/admin/db-stats', (req, res) => {
  try {
    const stats = dataStore.getStats();
    
    res.json({
      success: true,
      databaseStats: stats,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch database stats'
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
    error: 'Internal server error',
    details: error.message
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Endpoint not found: ${req.method} ${req.path}`,
    availableEndpoints: [
      'GET /ping - Health check',
      'GET /status - System status',
      'POST /setup/crypto - Initialize crypto',
      'GET /crypto/public-key - Get public key',
      'POST /balance/deposit - Deposit collateral',
      'POST /balance/withdraw - Withdraw collateral',
      'GET /balance/:user - Get user balance',
      'GET /balance/all - Get all balances',
      'POST /trade/submit - Submit encrypted trade',
      'POST /trade/encrypt-sample - Create sample trade',
      'GET /trade/pending - Get pending trades',
      'GET /trade/processed - Get processed trades',
      'POST /trade/validate - Validate trade',
      'GET /trade/validation-config - Get validation config',
      'GET /batch/history - Get batch history',
      'GET /batch/latest - Get latest batch',
      'GET /position/:user - Get user positions',
      'GET /position/all - Get all positions',
      'GET /asset/:assetId/positions - Get asset positions',
      'GET /merkle/stats - Get merkle tree stats',
      'GET /merkle/proof/:trader/:assetId - Generate proof',
      'POST /fees/calculate - Calculate fees',
      'GET /fees/summary - Get fee summary',
      'POST /admin/clear - Clear all data',
      'GET /admin/verify - Verify integrity',
      'GET /admin/db-stats - Get database stats'
    ]
  });
});

// Start server
async function startServer() {
  try {
    console.log('🚀 Starting Private Perps Executor Server...');
    
    // Initialize crypto system on startup
    await initializeCrypto();
    
    app.listen(PORT, () => {
      console.log(`✅ Server running on http://localhost:${PORT}`);
      console.log('📋 Available endpoints:');
      console.log('  GET  /ping                            - Health check');
      console.log('  GET  /status                          - System status');
      console.log('  POST /setup/crypto                    - Initialize crypto');
      console.log('  GET  /crypto/public-key               - Get public key');
      console.log('  POST /balance/deposit                 - Deposit collateral');
      console.log('  POST /balance/withdraw                - Withdraw collateral');
      console.log('  GET  /balance/:user                   - Get user balance');
      console.log('  GET  /balance/all                     - Get all balances');
      console.log('  POST /trade/submit                    - Submit encrypted trade');
      console.log('  POST /trade/encrypt-sample            - Create sample trade');
      console.log('  GET  /trade/pending                   - Get pending trades');
      console.log('  GET  /trade/processed                 - Get processed trades');
      console.log('  POST /trade/validate                  - Validate trade');
      console.log('  GET  /trade/validation-config         - Get validation config');
      console.log('  GET  /batch/history                   - Get batch history');
      console.log('  GET  /batch/latest                    - Get latest batch');
      console.log('  GET  /position/:user                  - Get user positions');
      console.log('  GET  /position/all                    - Get all positions');
      console.log('  GET  /asset/:assetId/positions        - Get asset positions');
      console.log('  GET  /merkle/stats                    - Get merkle tree stats');
      console.log('  GET  /merkle/proof/:trader/:assetId   - Generate proof');
      console.log('  POST /fees/calculate                  - Calculate fees');
      console.log('  GET  /fees/summary                    - Get fee summary');
      console.log('  POST /admin/clear                     - Clear all data (testing)');
      console.log('  GET  /admin/verify                    - Verify system integrity');
      console.log('  GET  /admin/db-stats                  - Get database stats');
      console.log('');
      console.log('🔑 Private Perps Executor ready for testing!');
    });
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();