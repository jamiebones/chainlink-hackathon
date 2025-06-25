import { verifyMessage } from 'ethers';
import { 
  hpkeDecrypt, 
  decryptJSON, 
  EncryptedData 
} from './cryptography';
import { poseidonMerkleTree } from './merkle-tree';
import { balanceManager } from './balance-manager';
import { feeCalculator } from './fee-calculator';
import { positionManager } from './position-manager';
import { tradeValidator } from './trade-validator';
import { dataStore } from './data-store';
import { processBatch, getCurrentPrice } from './contracts';

// ====================================================================
// INTERFACES & TYPES
// ====================================================================

export interface TradePayload {
  trader: string;      // Main wallet address
  assetId: number;     // Asset ID (0-4)
  qty: string;         // Position size in USD (always positive)
  margin: string;      // Collateral amount in USDC (6 decimals)
  isLong: boolean;     // Direction: true = long, false = short
  timestamp: number;   // Unix timestamp
}

export interface EncryptedTradePayload {
  payload: TradePayload;
  signature: string;   // Burner wallet signature
  burnerWallet: string; // Burner wallet address
}

export interface ProcessedTrade extends EncryptedTradePayload {
  tradeId: string;
  isValid: boolean;
  errors?: string[];
}

// ====================================================================
// MAIN EXECUTOR CLASS
// ====================================================================

export class TradeExecutor {
  private processingBatch = false;
  private lastProcessedBlock = 0;
  private readonly BATCH_INTERVAL = 2; // Process every 2 blocks
  private tradeCounter = 0;
  private batchCounter = 0;

  constructor() {
    console.log('🚀 TradeExecutor initializing...');
    
    // Restore last processed block from database
    this.lastProcessedBlock = dataStore.getLastProcessedBlock();
    
    // Start batch processing
    this.startBatchProcessor();
    
    console.log('✅ TradeExecutor initialized');
  }

  // ====================================================================
  // 1. TRADE PROCESSING PIPELINE
  // ====================================================================

  /**
   * Process encrypted trade submission
   */
  async processEncryptedTrade(encryptedData: EncryptedData): Promise<ProcessedTrade> {
    const tradeId = this.generateTradeId();
    console.log(`\n🔄 Processing encrypted trade: ${tradeId}`);

    try {
      // Step 1: Decrypt and verify
      const decryptedPayload = await this.decryptAndVerify(encryptedData);
      
      // Step 2: Validate trade
      const validationResult = await tradeValidator.validateTrade(decryptedPayload.payload);
      
      // Step 3: Create processed trade
      const processedTrade: ProcessedTrade = {
        ...decryptedPayload,
        tradeId,
        isValid: validationResult.isValid,
        errors: validationResult.isValid ? undefined : validationResult.errors
      };

      // Step 4: Save to database
      dataStore.saveTrade({
        tradeId,
        trader: processedTrade.payload.trader,
        assetId: processedTrade.payload.assetId,
        qty: BigInt(processedTrade.payload.qty),
        margin: BigInt(processedTrade.payload.margin),
        isLong: processedTrade.payload.isLong,
        timestamp: processedTrade.payload.timestamp,
        isValid: processedTrade.isValid,
        errors: processedTrade.errors
      });

      if (validationResult.isValid) {
        console.log(`✅ Trade ${tradeId} validated and queued`);
        console.log(`📊 ${processedTrade.payload.trader} ${processedTrade.payload.isLong ? 'LONG' : 'SHORT'} ${Number(BigInt(processedTrade.payload.qty))/1e6} asset ${processedTrade.payload.assetId}`);
      } else {
        console.log(`❌ Trade ${tradeId} rejected: ${validationResult.errors.join(', ')}`);
      }

      return processedTrade;

    } catch (error) {
      console.error(`❌ Trade processing failed for ${tradeId}:`, error);
      
      // Save failed trade
      const failedTrade: ProcessedTrade = {
        payload: {} as TradePayload,
        signature: '',
        burnerWallet: '',
        tradeId,
        isValid: false,
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };

      dataStore.saveTrade({
        tradeId,
        trader: '',
        assetId: 0,
        qty: 0n,
        margin: 0n,
        isLong: true,
        timestamp: Date.now(),
        isValid: false,
        errors: failedTrade.errors
      });

      throw error;
    }
  }

  /**
   * Decrypt and verify encrypted trade payload
   */
  private async decryptAndVerify(encryptedData: EncryptedData): Promise<EncryptedTradePayload> {
    // Decrypt
    const decrypted = await decryptJSON(encryptedData);
    
    // Validate structure
    if (!decrypted.payload || !decrypted.signature || !decrypted.burnerWallet) {
      throw new Error('Invalid encrypted payload structure');
    }

    // Verify signature
    const tradeMessage = JSON.stringify(decrypted.payload);
    const recoveredAddress = verifyMessage(tradeMessage, decrypted.signature);

    if (recoveredAddress.toLowerCase() !== decrypted.burnerWallet.toLowerCase()) {
      throw new Error(`Signature verification failed: ${recoveredAddress} !== ${decrypted.burnerWallet}`);
    }

    return decrypted as EncryptedTradePayload;
  }

  // ====================================================================
  // 2. BATCH PROCESSING (EVERY 2 BLOCKS)
  // ====================================================================

  /**
   * Start the batch processor
   */
  private startBatchProcessor(): void {
    console.log('🔄 Starting batch processor (every 2 blocks)...');
    
    setInterval(async () => {
      const currentBlock = await this.getCurrentBlock();
      
      if (currentBlock - this.lastProcessedBlock >= this.BATCH_INTERVAL) {
        await this.processBatch(currentBlock);
      }
    }, 15000); // Check every 15 seconds
  }

  /**
   * Process pending trades in a batch
   */
  private async processBatch(currentBlock: number): Promise<void> {
    if (this.processingBatch) {
      console.log('⏳ Batch already processing, skipping...');
      return;
    }

    const pendingTrades = dataStore.getPendingTrades();
    if (pendingTrades.length === 0) {
      console.log('📭 No pending trades to process');
      return;
    }

    this.processingBatch = true;
    const batchId = this.generateBatchId();
    
    console.log(`\n🏭 Processing batch ${batchId} with ${pendingTrades.length} trades at block ${currentBlock}`);

    // Create checkpoint for rollback
    const checkpoint = poseidonMerkleTree.createCheckpoint();
    
    try {
      // Step 1: Lock user balances
      await this.lockTradeBalances(pendingTrades);

      // Step 2: Calculate and deduct fees
      const totalFees = await this.processTradesFees(pendingTrades);

      // Step 3: Calculate net deltas per asset
      const assetDeltas = await this.calculateAssetDeltas(pendingTrades);

      // Step 4: Update positions and merkle tree
      const { oldRoots, newRoots } = await this.updatePositionsAndMerkleTree(pendingTrades, assetDeltas);

      // Step 5: Submit batch to contract
      const txHash = await this.submitBatchToContract(assetDeltas, oldRoots, newRoots);

      // Step 6: Finalize batch
      await this.finalizeBatch(batchId, pendingTrades, assetDeltas, totalFees, currentBlock, txHash);

      this.lastProcessedBlock = currentBlock;
      dataStore.setLastProcessedBlock(currentBlock);
      
      console.log(`✅ Batch ${batchId} processed successfully: ${txHash}`);

    } catch (error) {
      console.error(`❌ Batch ${batchId} failed:`, error);
      
      // Rollback changes
      await this.rollbackBatch(checkpoint, pendingTrades);
      
      // Save failed batch
      dataStore.saveBatch({
        batchId,
        assetIds: [],
        netDeltas: [],
        marginDeltas: [],
        processedTrades: 0,
        totalFees: 0n,
        timestamp: Date.now(),
        blockNumber: currentBlock,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

    } finally {
      this.processingBatch = false;
    }
  }

  /**
   * Lock balances for trades in the batch
   */
  private async lockTradeBalances(trades: any[]): Promise<void> {
    console.log('🔒 Locking user balances for batch...');
    
    const locks = trades.map(trade => ({
      user: trade.trader,
      amount: trade.margin
    }));

    const success = balanceManager.batchLockBalances(locks);
    if (!success) {
      throw new Error('Failed to lock balances for batch');
    }

    console.log(`✅ Locked balances for ${trades.length} trades`);
  }

  /**
   * Process fees for all trades
   */
  private async processTradesFees(trades: any[]): Promise<bigint> {
    console.log('💰 Processing fees for trades...');
    
    let totalFees = 0n;

    for (const trade of trades) {
      const feeBreakdown = await feeCalculator.calculateOpenPositionFees(
        trade.qty,
        trade.margin
      );

      balanceManager.deductFee(trade.trader, feeBreakdown.totalFees);
      totalFees += feeBreakdown.totalFees;
    }

    console.log(`✅ Processed total fees: ${Number(totalFees)/1e6}`);
    return totalFees;
  }

  /**
   * Calculate net deltas per asset
   */
  private async calculateAssetDeltas(trades: any[]): Promise<Map<number, {
    netQtyDelta: bigint;
    netMarginDelta: bigint;
    trades: any[];
  }>> {
    console.log('📊 Calculating net deltas per asset...');
    
    const assetDeltas = new Map<number, {
      netQtyDelta: bigint;
      netMarginDelta: bigint;
      trades: any[];
    }>();

    for (const trade of trades) {
      const assetId = trade.assetId;
      
      if (!assetDeltas.has(assetId)) {
        assetDeltas.set(assetId, {
          netQtyDelta: 0n,
          netMarginDelta: 0n,
          trades: []
        });
      }

      const data = assetDeltas.get(assetId)!;
      
      // Net quantity: positive for long, negative for short
      const signedQty = trade.isLong ? trade.qty : -trade.qty;
      data.netQtyDelta += signedQty;
      
      // Net margin: after fees
      const feeBreakdown = await feeCalculator.calculateOpenPositionFees(trade.qty, trade.margin);
      data.netMarginDelta += feeBreakdown.netMargin;
      
      data.trades.push(trade);
    }

    // Log deltas
    for (const [assetId, data] of assetDeltas) {
      console.log(`   Asset ${assetId}: netQty=${this.formatDelta(data.netQtyDelta)}, netMargin=${Number(data.netMarginDelta)/1e6}`);
    }

    return assetDeltas;
  }

  /**
   * Update positions in merkle tree
   */
  private async updatePositionsAndMerkleTree(
    trades: any[], 
    assetDeltas: Map<number, any>
  ): Promise<{ oldRoots: string[], newRoots: string[] }> {
    console.log('🌳 Updating positions and merkle tree...');
    
    const oldRoots: string[] = [];
    const newRoots: string[] = [];

    // Get old root
    const oldRoot = poseidonMerkleTree.getCurrentRootHex();
    
    // Update positions
    for (const trade of trades) {
      const currentPrice = await getCurrentPrice(trade.assetId);
      const feeBreakdown = await feeCalculator.calculateOpenPositionFees(trade.qty, trade.margin);
      
      const position = {
        trader: trade.trader,
        assetId: trade.assetId,
        size: trade.isLong ? trade.qty : -trade.qty,
        margin: feeBreakdown.netMargin,
        entryPrice: currentPrice,
        entryFunding: 0n, // Mock for MVP
        lastUpdate: Date.now()
      };

      // Update in both managers
      positionManager.updatePosition(position);
      await poseidonMerkleTree.updatePosition(position);
    }

    // Get new root
    const newRoot = poseidonMerkleTree.getCurrentRootHex();
    
    // For each asset, use the same old/new root (simplified for MVP)
    for (const assetId of assetDeltas.keys()) {
      oldRoots.push(oldRoot);
      newRoots.push(newRoot);
    }

    console.log(`✅ Updated ${trades.length} positions`);
    console.log(`🌳 Root transition: ${oldRoot.substring(0, 10)}... → ${newRoot.substring(0, 10)}...`);

    return { oldRoots, newRoots };
  }

  /**
   * Submit batch to contract
   */
  private async submitBatchToContract(
    assetDeltas: Map<number, any>,
    oldRoots: string[],
    newRoots: string[]
  ): Promise<string> {
    console.log('📤 Submitting batch to PerpEngineZK...');
    
    const assetIds: number[] = [];
    const netDeltas: bigint[] = [];
    const marginDeltas: bigint[] = [];

    for (const [assetId, data] of assetDeltas) {
      assetIds.push(assetId);
      netDeltas.push(data.netQtyDelta);
      marginDeltas.push(data.netMarginDelta);
    }

    console.log('🔗 Calling contract: processBatch()');
    console.log(`   Assets: [${assetIds.join(', ')}]`);
    console.log(`   Net deltas: [${netDeltas.map(d => this.formatDelta(d)).join(', ')}]`);
    console.log(`   Margin deltas: [${marginDeltas.map(d => `${Number(d)/1e6}`).join(', ')}]`);

    // Call real contract
    const txHash = await processBatch(assetIds, oldRoots, newRoots, netDeltas, marginDeltas);
    
    console.log(`✅ Contract call successful: ${txHash}`);
    return txHash;
  }

  /**
   * Finalize successful batch
   */
  private async finalizeBatch(
    batchId: string,
    trades: any[],
    assetDeltas: Map<number, any>,
    totalFees: bigint,
    blockNumber: number,
    txHash: string
  ): Promise<void> {
    // Mark trades as processed
    const tradeIds = trades.map(t => t.tradeId);
    dataStore.markTradesAsProcessed(tradeIds, batchId);

    // Save batch record
    dataStore.saveBatch({
      batchId,
      assetIds: Array.from(assetDeltas.keys()),
      netDeltas: Array.from(assetDeltas.values()).map(d => d.netQtyDelta),
      marginDeltas: Array.from(assetDeltas.values()).map(d => d.netMarginDelta),
      processedTrades: trades.length,
      totalFees,
      timestamp: Date.now(),
      blockNumber,
      txHash,
      success: true
    });

    console.log(`📋 Batch ${batchId} finalized: ${trades.length} trades, ${Number(totalFees)/1e6} fees`);
  }

  /**
   * Rollback failed batch
   */
  private async rollbackBatch(checkpoint: any, trades: any[]): Promise<void> {
    console.log('🔄 Rolling back failed batch...');
    
    // Restore merkle tree
    await poseidonMerkleTree.restoreFromCheckpoint(checkpoint);
    
    // Unlock user balances
    for (const trade of trades) {
      balanceManager.unlockBalance(trade.trader, trade.margin);
    }
    
    console.log('✅ Batch rollback complete');
  }

  // ====================================================================
  // 3. BALANCE MANAGEMENT
  // ====================================================================

  /**
   * Handle user collateral deposit
   */
  async depositCollateral(user: string, amount: bigint): Promise<string> {
    console.log(`💰 Processing deposit: ${user} deposits ${Number(amount)/1e6}`);
    return await balanceManager.deposit(user, amount);
  }

  /**
   * Handle user collateral withdrawal
   */
  async withdrawCollateral(user: string, amount: bigint): Promise<string> {
    console.log(`💸 Processing withdrawal: ${user} withdraws ${Number(amount)/1e6}`);
    return await balanceManager.withdraw(user, amount);
  }

  // ====================================================================
  // 4. QUERIES & STATISTICS
  // ====================================================================

  /**
   * Get pending trades
   */
  getPendingTrades(): any[] {
    return dataStore.getPendingTrades();
  }

  /**
   * Get processed trades
   */
  getProcessedTrades(limit: number = 100): any[] {
    return dataStore.getTrades(limit);
  }

  /**
   * Get batch history
   */
  getBatchHistory(limit: number = 50): any[] {
    return dataStore.getBatches(limit);
  }

  /**
   * Get latest batch
   */
  getLatestBatch(): any {
    return dataStore.getLatestBatch();
  }

  /**
   * Get executor statistics
   */
  async getStats(): Promise<{
    trades: any;
    batches: any;
    balances: any;
    positions: any;
    merkleTree: any;
    database: any;
  }> {
    return {
      trades: {
        pending: this.getPendingTrades().length,
        processed: dataStore.getTrades().length
      },
      batches: {
        total: dataStore.getBatches().length,
        lastProcessedBlock: this.lastProcessedBlock
      },
      balances: balanceManager.getStats(),
      positions: await positionManager.getStats(),
      merkleTree: poseidonMerkleTree.getStats(),
      database: dataStore.getStats()
    };
  }

  // ====================================================================
  // 5. UTILITIES
  // ====================================================================

  /**
   * Generate unique trade ID
   */
  private generateTradeId(): string {
    this.tradeCounter++;
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `trade_${timestamp}_${this.tradeCounter}_${random}`;
  }

  /**
   * Generate unique batch ID
   */
  private generateBatchId(): string {
    this.batchCounter++;
    const timestamp = Date.now();
    return `batch_${timestamp}_${this.batchCounter}`;
  }

  /**
   * Get current block number (mock for MVP)
   */
  private async getCurrentBlock(): Promise<number> {
    // Mock implementation - simulate 15s block time
    return Math.floor(Date.now() / 15000);
  }

  /**
   * Format delta for display
   */
  private formatDelta(delta: bigint): string {
    const abs = delta < 0n ? -delta : delta;
    const sign = delta < 0n ? '-' : '+';
    return `${sign}${Number(abs)/1e6}`;
  }

  /**
   * Clear all data (for testing)
   */
  async clear(): Promise<void> {
    dataStore.clear();
    await poseidonMerkleTree.clear();
    this.tradeCounter = 0;
    this.batchCounter = 0;
    this.lastProcessedBlock = 0;
    console.log('🧹 Executor cleared');
  }

  /**
   * Verify system integrity
   */
  async verifyIntegrity(): Promise<boolean> {
    try {
      const merkleOk = await poseidonMerkleTree.verifyIntegrity();
      
      console.log(`${merkleOk ? '✅' : '❌'} System integrity check ${merkleOk ? 'passed' : 'failed'}`);
      return merkleOk;
    } catch (error) {
      console.error('❌ System integrity check failed:', error);
      return false;
    }
  }
}

// ====================================================================
// EXPORT
// ====================================================================

export const tradeExecutor = new TradeExecutor();