import express from 'express';
import cors from 'cors';
import { cryptoManager, EncryptedData, TradePayload, ClosePositionPayload } from './crypto';
import { database } from './database';
import { feeCalculator } from './fees';
import { merkleTree } from './merkle';
import { contractManager } from './contracts';
import { executor } from './executor';
import { closeExecutor } from './close-executor';

// ====================================================================
// MINIMAL API SERVER FOR TESTING
// ====================================================================

// Global BigInt serialization fix
const originalJSON = JSON.stringify;
JSON.stringify = function(value, replacer, space) {
  return originalJSON(value, function(key, val) {
    if (typeof val === 'bigint') {
      return val.toString();
    }
    return typeof replacer === 'function' ? replacer(key, val) : val;
  }, space);
};

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Request logging
app.use((req, res, next) => {
  console.log(`📡 ${req.method} ${req.path} - ${new Date().toISOString()}`);
  next();
});

// ====================================================================
// 1. HEALTH & STATUS
// ====================================================================

/**
 * Health check
 */
app.get('/ping', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Minimal Private Perps Executor',
    timestamp: new Date().toISOString()
  });
});

/**
 * System status
 */
app.get('/status', async (req, res) => {
  try {
    const [contractStatus, executorStats, databaseStats, merkleStats, closeExecutorStats] = await Promise.all([
      contractManager.getStatus(),
      executor.getStats(),
      database.getStats(),
      merkleTree.getStats(),
      closeExecutor.getStats()
    ]);

    res.json({
      status: 'healthy',
      contracts: contractStatus,
      executor: executorStats,
      database: databaseStats,
      merkleTree: merkleStats,
      closeExecutor: closeExecutorStats,
      crypto: cryptoManager.getStatus(),
      fees: feeCalculator.getFeeSummary(),
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

// ====================================================================
// 2. CRYPTO INITIALIZATION
// ====================================================================

/**
 * Initialize crypto system
 */
app.post('/setup/crypto', async (req, res) => {
  try {
    const { forceRegenerate = false } = req.body;
    
    const publicKey = await cryptoManager.initialize(forceRegenerate);
    
    res.json({
      success: true,
      message: 'Crypto system initialized',
      publicKey,
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
 * Get public key
 */
app.get('/crypto/public-key', (req, res) => {
  try {
    const publicKey = cryptoManager.getPublicKey();
    
    res.json({
      success: true,
      publicKey,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
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
app.post('/balance/add', (req, res) => {
  try {
    const { user, amount } = req.body;
    
    if (!user || !amount) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: user, amount'
      });
    }

    const amountBigInt = BigInt(amount);
    database.addBalance(user, amountBigInt);
    
    const newBalance = database.getUserBalance(user);
    
    res.json({
      success: true,
      message: 'Balance added successfully',
      user,
      balance: {
        total: newBalance.total.toString(),
        available: newBalance.available.toString(),
        locked: newBalance.locked.toString(),
        lastUpdate: newBalance.lastUpdate
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to add balance'
    });
  }
});

/**
 * Get user balance
 */
app.get('/balance/:user', (req, res) => {
  try {
    const { user } = req.params;
    const balance = database.getUserBalance(user);
    
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
    const allBalances = database.getAllBalances();
    
    res.json({
      success: true,
      balances: allBalances.map(({ address, balance }) => ({
        address,
        balance: {
          total: balance.total.toString(),
          available: balance.available.toString(),
          locked: balance.locked.toString(),
          lastUpdate: balance.lastUpdate
        }
      })),
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
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
    const processedTrade = await executor.processEncryptedTrade(encryptedData);
    
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
        pendingTrades: executor.getPendingTrades().length
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
 * Create sample encrypted trade (for testing)
 */
app.post('/trade/create-sample', async (req, res) => {
  try {
    const overrides = req.body || {};
    
    const encrypted = await cryptoManager.createSampleEncryptedTrade(overrides);
    
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
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create sample trade'
    });
  }
});

/**
 * Create simple test trade (no signature verification)
 */
app.post('/trade/create-test', async (req, res) => {
  try {
    const sampleTrade: TradePayload = {
      trader: req.body.trader || "0x742d35Cc6635C0532925a3b8FF1F4b4a5c2b9876",
      assetId: req.body.assetId || 0,
      qty: req.body.qty || "500000000", // $500
      margin: req.body.margin || "50000000", // $50
      isLong: req.body.isLong !== undefined ? req.body.isLong : true,
      timestamp: Date.now()
    };

    // Create payload without signature verification for testing
    const testPayload = {
      payload: sampleTrade,
      signature: "TEST_MODE", // Special test signature
      burnerWallet: sampleTrade.trader
    };
    
    const encrypted = await cryptoManager.encryptJSON(testPayload);
    
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
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create test trade'
    });
  }
});

// ====================================================================
// 4B. POSITION CLOSING
// ====================================================================

/**
 * Create close position request
 */
app.post('/trade/create-close', async (req, res) => {
  try {
    const closeRequest: ClosePositionPayload = {
      trader: req.body.trader || "0x742d35Cc6635C0532925a3b8FF1F4b4a5c2b9876",
      assetId: req.body.assetId || 0,
      closePercent: req.body.closePercent || 100, // Default full close
      timestamp: Date.now()
    };

    const encrypted = await cryptoManager.createSampleClosePosition(closeRequest);
    
    res.json({
      success: true,
      message: 'Close position request created',
      encrypted: {
        enc: encrypted.enc,
        ct: encrypted.ct
      },
      closeRequest,
      instructions: 'Use this encrypted data with POST /trade/close',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create close request'
    });
  }
});

/**
 * Submit close position request
 */
app.post('/trade/close', async (req, res) => {
  try {
    const { enc, ct } = req.body;
    
    if (!enc || !ct) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: enc, ct'
      });
    }
    
    console.log('🔄 Processing encrypted close submission...');
    
    const encryptedData: EncryptedData = { enc, ct };
    const processedClose = await closeExecutor.processEncryptedClose(encryptedData);
    
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
          priceChange: `${processedClose.marketData.priceChange > 0 ? '+' : ''}${processedClose.marketData.priceChange.toFixed(2)}%`
        },
        pnl: {
          unrealizedPnL: processedClose.pnl.unrealizedPnL.toString(),
          unrealizedPnLUSD: `$${(Number(processedClose.pnl.unrealizedPnL) / 1e6).toFixed(2)}`,
          closingFees: processedClose.pnl.closingFees.toString(),
          closingFeesUSD: `$${(Number(processedClose.pnl.closingFees) / 1e6).toFixed(2)}`,
          netPayout: processedClose.pnl.netPayout.toString(),
          netPayoutUSD: `$${(Number(processedClose.pnl.netPayout) / 1e6).toFixed(2)}`
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
        pendingCloses: closeExecutor.getPendingCloses().length
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Close submission failed:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Close submission failed'
    });
  }
});

// ====================================================================
// 5. BATCH PROCESSING
// ====================================================================

/**
 * Get pending trades
 */
app.get('/batch/pending', (req, res) => {
  try {
    const pendingTrades = executor.getPendingTrades();
    
    res.json({
      success: true,
      pendingTrades: pendingTrades.map(trade => ({
        tradeId: trade.tradeId,
        trader: trade.trader,
        assetId: trade.assetId,
        qty: trade.qty.toString(),
        margin: trade.margin.toString(),
        isLong: trade.isLong,
        isValid: trade.isValid,
        errors: trade.errors,
        timestamp: trade.timestamp
      })),
      count: pendingTrades.length,
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
 * Force batch processing
 */
app.post('/batch/process', async (req, res) => {
  try {
    console.log('🚀 Manual batch processing requested...');
    
    const result = await executor.forceBatchProcessing();
    
    if (!result) {
      return res.json({
        success: true,
        message: 'No trades to process',
        timestamp: new Date().toISOString()
      });
    }
    
    res.json({
      success: true,
      message: result.success ? 'Batch processed successfully' : 'Batch processing failed',
      batch: {
        batchId: result.batchId,
        processedTrades: result.processedTrades,
        assetIds: result.assetIds,
        netDeltas: result.netDeltas.map(d => d.toString()),
        marginDeltas: result.marginDeltas.map(d => d.toString()),
        oldRoot: result.oldRoot,
        newRoot: result.newRoot,
        txHash: result.txHash,
        totalFees: result.totalFees.toString(),
        success: result.success,
        error: result.error
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Batch processing failed'
    });
  }
});

// ====================================================================
// 5B. CLOSE BATCH PROCESSING
// ====================================================================

/**
 * Get pending closes
 */
app.get('/close/pending', (req, res) => {
  try {
    const pendingCloses = closeExecutor.getPendingCloses();
    
    res.json({
      success: true,
      pendingCloses: pendingCloses.map(close => ({
        closeId: close.closeId,
        trader: close.trader,
        assetId: close.assetId,
        closePercent: close.closePercent,
        unrealizedPnL: close.pnl.unrealizedPnL.toString(),
        netPayout: close.pnl.netPayout.toString(),
        isFullClose: close.position.isFullClose,
        timestamp: close.timestamp
      })),
      count: pendingCloses.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch pending closes'
    });
  }
});

/**
 * Force close batch processing
 */
app.post('/close/process', async (req, res) => {
  try {
    console.log('🚀 Manual close batch processing requested...');
    
    const result = await closeExecutor.forceCloseBatchProcessing();
    
    if (!result) {
      return res.json({
        success: true,
        message: 'No closes to process',
        timestamp: new Date().toISOString()
      });
    }
    
    res.json({
      success: true,
      message: result.success ? 'Close batch processed successfully' : 'Close batch processing failed',
      batch: {
        batchId: result.batchId,
        processedCloses: result.processedCloses,
        totalPnL: result.totalPnL.toString(),
        totalPnLUSD: `$${(Number(result.totalPnL) / 1e6).toFixed(2)}`,
        totalFees: result.totalFees.toString(),
        totalFeesUSD: `$${(Number(result.totalFees) / 1e6).toFixed(2)}`,
        totalPayout: result.totalPayout.toString(),
        totalPayoutUSD: `$${(Number(result.totalPayout) / 1e6).toFixed(2)}`,
        affectedAssets: result.affectedAssets,
        oldRoot: result.oldRoot,
        newRoot: result.newRoot,
        txHash: result.txHash,
        success: result.success,
        error: result.error
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Close batch processing failed'
    });
  }
});


// ====================================================================
// 6. POSITIONS & MERKLE TREE
// ====================================================================

/**
 * Get user positions
 */
app.get('/position/:user', (req, res) => {
  try {
    const { user } = req.params;
    const positions = database.getTraderPositions(user);
    
    res.json({
      success: true,
      user,
      positions: positions.map(pos => ({
        assetId: pos.assetId,
        size: pos.size.toString(),
        margin: pos.margin.toString(),
        entryPrice: pos.entryPrice.toString(),
        isLong: pos.size > 0n,
        lastUpdate: pos.lastUpdate
      })),
      count: positions.length,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch positions'
    });
  }
});

/**
 * Get merkle proof for position
 */
app.get('/merkle/proof/:trader/:assetId', (req, res) => {
  try {
    const { trader, assetId } = req.params;
    const proof = merkleTree.generateProof(trader, parseInt(assetId));
    
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
        siblings: proof.siblings.map(s => s.toString()),
        pathIndices: proof.pathIndices,
        leafIndex: proof.leafIndex
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

/**
 * Get merkle tree stats
 */
app.get('/merkle/stats', (req, res) => {
  try {
    const stats = merkleTree.getStats();
    
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

// ====================================================================
// 6B. PNL & ANALYTICS
// ====================================================================

/**
 * Get current PnL for user positions
 */
app.get('/pnl/:user', async (req, res) => {
  try {
    const { user } = req.params;
    const { assetId } = req.query;
    
    console.log(`📊 Getting PnL for user: ${user}${assetId ? ` asset: ${assetId}` : ''}`);
    
    const pnlData = await closeExecutor.calculateCurrentPnL(
      user, 
      assetId ? parseInt(assetId as string) : undefined
    );
    
    res.json({
      success: true,
      trader: pnlData.trader,
      summary: {
        totalUnrealizedPnL: pnlData.totalUnrealizedPnL.toString(),
        totalUnrealizedPnLUSD: `$${(Number(pnlData.totalUnrealizedPnL) / 1e6).toFixed(2)}`,
        totalClosingFees: pnlData.totalClosingFees.toString(),
        totalClosingFeesUSD: `$${(Number(pnlData.totalClosingFees) / 1e6).toFixed(2)}`,
        netPnL: pnlData.netPnL.toString(),
        netPnLUSD: `$${(Number(pnlData.netPnL) / 1e6).toFixed(2)}`,
        positionCount: pnlData.positions.length,
        status: pnlData.netPnL > 0n ? 'PROFIT' : pnlData.netPnL < 0n ? 'LOSS' : 'BREAKEVEN'
      },
      positions: pnlData.positions.map(pos => ({
        assetId: pos.assetId,
        side: pos.isLong ? 'LONG' : 'SHORT',
        size: pos.size.toString(),
        sizeUSD: `$${(Number(pos.size < 0n ? -pos.size : pos.size) / 1e6).toFixed(2)}`,
        entryPrice: pos.entryPrice.toString(),
        entryPriceFormatted: `$${(Number(pos.entryPrice) / 1e18).toFixed(2)}`,
        currentPrice: pos.currentPrice.toString(),
        currentPriceFormatted: `$${(Number(pos.currentPrice) / 1e18).toFixed(2)}`,
        unrealizedPnL: pos.unrealizedPnL.toString(),
        unrealizedPnLUSD: `$${(Number(pos.unrealizedPnL) / 1e6).toFixed(2)}`,
        closingFees: pos.closingFees.toString(),
        closingFeesUSD: `$${(Number(pos.closingFees) / 1e6).toFixed(2)}`,
        netPnL: pos.netPnL.toString(),
        netPnLUSD: `$${(Number(pos.netPnL) / 1e6).toFixed(2)}`,
        pnlPercent: `${pos.pnlPercent > 0 ? '+' : ''}${pos.pnlPercent.toFixed(2)}%`,
        healthFactor: pos.healthFactor.toFixed(2),
        status: pos.netPnL > 0n ? 'PROFIT' : pos.netPnL < 0n ? 'LOSS' : 'BREAKEVEN'
      })),
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Failed to calculate PnL:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to calculate PnL'
    });
  }
});

// ====================================================================
// 7. FEES & CONFIGURATION
// ====================================================================

/**
 * Get fee configuration
 */
app.get('/fees/config', async (req, res) => {
  try {
    const [localConfig, contractConfig] = await Promise.all([
      feeCalculator.getFeeSummary(),
      contractManager.getFeeConfig()
    ]);
    
    res.json({
      success: true,
      fees: {
        local: localConfig,
        contract: {
          openFee: `${contractConfig.openFeeBps / 100}%`,
          closeFee: `${contractConfig.closeFeeBps / 100}%`,
          borrowingRateAnnual: `${contractConfig.borrowingRateAnnualBps / 100}%`,
          minCollateralRatio: `${contractConfig.minCollateralRatioBps / 100}%`,
          maxUtilization: `${contractConfig.maxUtilizationBps / 100}%`
        }
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch fee configuration'
    });
  }
});

/**
 * Calculate fees for a position
 */
app.post('/fees/calculate', (req, res) => {
  try {
    const { positionSize, margin, isLong } = req.body;
    
    if (!positionSize || !margin || typeof isLong !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: positionSize, margin, isLong'
      });
    }
    
    const fees = feeCalculator.calculateNewPositionFees(
      BigInt(positionSize),
      BigInt(margin),
      isLong
    );
    
    res.json({
      success: true,
      fees: {
        openingFee: fees.openingFee.toString(),
        totalFees: fees.totalFees.toString(),
        netMargin: fees.netMargin.toString()
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
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
app.post('/test/clear', (req, res) => {
  try {
    database.clear();
    merkleTree.clear();
    executor.clear();
    
    res.json({
      success: true,
      message: 'All data cleared',
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
app.get('/test/verify', (req, res) => {
  try {
    const merkleIntegrity = merkleTree.verifyIntegrity();
    
    res.json({
      success: true,
      integrity: {
        merkleTree: merkleIntegrity,
        overall: merkleIntegrity
      },
      message: merkleIntegrity ? 'System integrity verified' : 'System integrity check failed',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
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

async function startServer() {
  try {
    console.log('🚀 Starting Minimal Private Perps Executor...');
    
    // Initialize crypto system
    await cryptoManager.initialize();
    
    // Check contract connectivity
    const connected = await contractManager.checkConnection();
    if (!connected) {
      console.warn('⚠️ Contract connectivity issues - some features may not work');
    }
    
    app.listen(PORT, () => {
      console.log(`✅ Server running on http://localhost:${PORT}`);
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
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();