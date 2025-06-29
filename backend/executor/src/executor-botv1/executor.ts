// FIXED EXECUTOR - SIMPLIFIED FEE HANDLING
// Key changes marked with 🔧

import { cryptoManager, TradePayload, EncryptedData } from './crypto';
import { database, Position } from './database';
import { feeCalculator } from './fees';
import { merkleTree } from './merkle';
import { contractManager } from './contracts';

export interface ProcessedTrade {
  tradeId: string;
  trader: string;
  assetId: number;
  qty: bigint;
  margin: bigint;
  isLong: boolean;
  timestamp: number;
  isValid: boolean;
  errors?: string[];
  fees?: {
    openingFee: bigint;
    totalFees: bigint;
    netMargin: bigint;
  };
}

export interface BatchResult {
  batchId: string;
  processedTrades: number;
  assetIds: number[];
  netDeltas: bigint[];
  marginDeltas: bigint[];
  oldRoot: string;
  newRoot: string;
  txHash: string;
  totalFees: bigint;
  success: boolean;
  error?: string;
  timestamp: number;
}

export class MinimalExecutor {
  private pendingTrades: ProcessedTrade[] = [];
  private processingBatch = false;
  private tradeCounter = 0;
  private batchCounter = 0;
  
  private readonly BATCH_SIZE = 5;
  private readonly BATCH_TIMEOUT = 120000;
  private batchTimer: NodeJS.Timeout | null = null;

  constructor() {
    console.log('🚀 Minimal Executor initializing...');
    this.startBatchTimer();
    console.log('✅ Minimal Executor initialized');
    console.log(`⚙️ Batch size: ${this.BATCH_SIZE} trades`);
    console.log(`⏰ Batch timeout: ${this.BATCH_TIMEOUT / 1000}s`);
  }

  // ====================================================================
  // 🔧 FIXED TRADE PROCESSING - CLEAN FEE HANDLING
  // ====================================================================

  async processEncryptedTrade(encryptedData: EncryptedData): Promise<ProcessedTrade> {
    const tradeId = this.generateTradeId();
    console.log(`\n🔄 Processing encrypted trade: ${tradeId}`);

    try {
      // Step 1: Decrypt and verify
      const decryptedTrade = await cryptoManager.processEncryptedTrade(encryptedData);
      
      if (!decryptedTrade.isValid) {
        return this.createFailedTrade(tradeId, decryptedTrade.error || 'Decryption failed');
      }

      const { payload } = decryptedTrade;

      // Step 2: Validate trade
      const validationResult = await this.validateTrade(payload);
      if (!validationResult.isValid) {
        return this.createFailedTrade(tradeId, validationResult.errors.join(', '), payload);
      }

      // 🔧 Step 3: Calculate fees and check total balance requirement
      const feeResult = await this.calculateAndValidateFees(payload);
      if (!feeResult.success) {
        return this.createFailedTrade(tradeId, feeResult.error!, payload);
      }

      // 🔧 Step 4: NEW CLEAN FLOW - Deduct fees immediately and lock net margin
      const success = await this.processTradeBalanceAndFees(payload, feeResult.fees!);
      if (!success) {
        return this.createFailedTrade(tradeId, 'Failed to process balance and fees', payload);
      }

      // Step 5: Create successful trade
      const processedTrade: ProcessedTrade = {
        tradeId,
        trader: payload.trader,
        assetId: payload.assetId,
        qty: BigInt(payload.qty),
        margin: BigInt(payload.margin),
        isLong: payload.isLong,
        timestamp: payload.timestamp,
        isValid: true,
        fees: feeResult.fees
      };

      // Step 6: Add to pending trades
      this.pendingTrades.push(processedTrade);
      
      console.log(`✅ Trade ${tradeId} validated and queued`);
      console.log(`📊 ${payload.trader} ${payload.isLong ? 'LONG' : 'SHORT'} $${Number(BigInt(payload.qty))/1e6} asset ${payload.assetId}`);
      console.log(`💰 Fees: $${Number(feeResult.fees!.totalFees)/1e6}, Net margin locked: $${Number(feeResult.fees!.netMargin)/1e6}`);
      console.log(`📋 Pending trades: ${this.pendingTrades.length}/${this.BATCH_SIZE}`);

      // Step 7: Check if we should process batch
      if (this.pendingTrades.length >= this.BATCH_SIZE) {
        console.log('🚀 Batch size reached, processing immediately...');
        setTimeout(() => this.processBatch(), 120000);
      }

      return processedTrade;

    } catch (error) {
      console.error(`❌ Trade processing failed for ${tradeId}:`, error);
      return this.createFailedTrade(tradeId, error instanceof Error ? error.message : 'Unknown error');
    }
  }

  // ====================================================================
  // 🔧 NEW CLEAN BALANCE & FEE PROCESSING
  // ====================================================================

  private async processTradeBalanceAndFees(
    payload: TradePayload, 
    fees: { openingFee: bigint; totalFees: bigint; netMargin: bigint }
  ): Promise<boolean> {
    const trader = payload.trader;
    const totalMargin = BigInt(payload.margin);
    
    try {
      console.log(`💰 Processing balance for ${trader}:`);
      console.log(`   Total margin required: $${Number(totalMargin)/1e6}`);
      console.log(`   Fees to deduct: $${Number(fees.totalFees)/1e6}`);
      console.log(`   Net margin to lock: $${Number(fees.netMargin)/1e6}`);

      // Check if user has sufficient total balance
      const userBalance = database.getUserBalance(trader);
      if (userBalance.available < totalMargin) {
        console.error(`❌ Insufficient balance: $${Number(userBalance.available)/1e6} < $${Number(totalMargin)/1e6}`);
        return false;
      }

      // 🔧 CLEAN FLOW: 
      // 1. Deduct fees from available balance immediately
      const feeDeducted = database.deductFee(trader, fees.totalFees);
      if (!feeDeducted) {
        console.error(`❌ Failed to deduct fees`);
        return false;
      }

      // 2. Lock the net margin (after fees)
      const marginLocked = database.lockBalance(trader, fees.netMargin);
      if (!marginLocked) {
        // Rollback fee deduction
        console.error(`❌ Failed to lock net margin, rolling back fee deduction`);
        database.addBalance(trader, fees.totalFees);
        return false;
      }

      // Success!
      const finalBalance = database.getUserBalance(trader);
      console.log(`✅ Balance processed successfully:`);
      console.log(`   Available: $${Number(finalBalance.available)/1e6}`);
      console.log(`   Locked: $${Number(finalBalance.locked)/1e6}`);
      console.log(`   Total: $${Number(finalBalance.total)/1e6}`);

      return true;

    } catch (error) {
      console.error(`❌ Balance processing failed for ${trader}:`, error);
      return false;
    }
  }

  // ====================================================================
  // 🔧 SIMPLIFIED BATCH PROCESSING - NO MORE FEE COMPLICATIONS
  // ====================================================================

  async processBatch(): Promise<BatchResult | null> {
    if (this.processingBatch || this.pendingTrades.length === 0) {
      return null;
    }

    this.processingBatch = true;
    const batchId = this.generateBatchId();
    
    console.log(`\n🏭 Processing batch ${batchId} with ${this.pendingTrades.length} trades`);

    // Create checkpoint for rollback
    const checkpoint = merkleTree.createCheckpoint();
    const trades = [...this.pendingTrades];
    this.pendingTrades = [];

    try {
      // 🔧 Step 1: NO MORE FEE DEDUCTION - Already done during individual processing!
      console.log('💰 Fees already deducted during individual trade processing ✅');
      
      // Calculate total fees collected (for reporting)
      const totalFees = trades.reduce((sum, trade) => sum + (trade.fees?.totalFees || 0n), 0n);

      // Step 2: Calculate net deltas per asset
      const assetDeltas = this.calculateAssetDeltas(trades);

      // Step 3: Update positions and merkle tree
      const { oldRoot, newRoot } = await this.updatePositionsAndMerkleTree(trades);

      // Step 4: Submit batch to contract
      const txHash = await this.submitBatchToContract(assetDeltas, oldRoot, newRoot);

      // 🔧 Step 5: NO MORE BALANCE UNLOCKING - Net margin already locked correctly!
      console.log('🔓 No balance unlocking needed - net margins already locked correctly ✅');

      const result: BatchResult = {
        batchId,
        processedTrades: trades.length,
        assetIds: Array.from(assetDeltas.keys()),
        netDeltas: Array.from(assetDeltas.values()).map(d => d.netQtyDelta),
        marginDeltas: Array.from(assetDeltas.values()).map(d => d.netMarginDelta),
        oldRoot,
        newRoot,
        txHash,
        totalFees,
        success: true,
        timestamp: Date.now()
      };

      console.log(`✅ Batch ${batchId} processed successfully: ${txHash}`);
      console.log(`📊 Processed ${trades.length} trades, collected $${Number(totalFees)/1e6} fees`);

      return result;

    } catch (error) {
      console.error(`❌ Batch ${batchId} failed:`, error);
      
      // 🔧 Rollback changes
      await this.rollbackBatch(checkpoint, trades);
      
      const result: BatchResult = {
        batchId,
        processedTrades: 0,
        assetIds: [],
        netDeltas: [],
        marginDeltas: [],
        oldRoot: checkpoint.root.toString(),
        newRoot: checkpoint.root.toString(),
        txHash: '',
        totalFees: 0n,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now()
      };

      return result;

    } finally {
      this.processingBatch = false;
      this.startBatchTimer();
    }
  }

  // ====================================================================
  // 🔧 SIMPLIFIED ROLLBACK - CLEAN BALANCE RESTORATION
  // ====================================================================

  private async rollbackBatch(checkpoint: any, trades: ProcessedTrade[]): Promise<void> {
    console.log('🔄 Rolling back failed batch...');
    
    // Restore merkle tree
    merkleTree.restoreFromCheckpoint(checkpoint);
    
    // 🔧 CLEAN BALANCE ROLLBACK
    for (const trade of trades) {
      try {
        // Restore exactly what we did:
        // 1. Add back the fees we deducted
        if (trade.fees) {
          database.addBalance(trade.trader, trade.fees.totalFees);
          console.log(`↩️ Restored ${Number(trade.fees.totalFees)/1e6} fees to ${trade.trader}`);
        }
        
        // 2. Unlock the net margin we locked
        const currentBalance = database.getUserBalance(trade.trader);
        if (currentBalance.locked >= (trade.fees?.netMargin || 0n)) {
          database.unlockBalance(trade.trader, trade.fees?.netMargin || 0n);
          console.log(`🔓 Unlocked $${Number(trade.fees?.netMargin || 0n)/1e6} margin for ${trade.trader}`);
        } else {
          console.warn(`⚠️ Insufficient locked balance for rollback: ${trade.trader}`);
        }
        
      } catch (error) {
        console.error(`❌ Failed to rollback trade ${trade.tradeId}:`, error);
      }
    }
    
    // Add trades back to pending
    this.pendingTrades.unshift(...trades);
    
    console.log('✅ Batch rollback complete');
  }

  // ====================================================================
  // UNCHANGED METHODS (keeping existing logic)
  // ====================================================================

  private async validateTrade(payload: TradePayload): Promise<{
    isValid: boolean;
    errors: string[];
  }> {
    const errors: string[] = [];

    // Basic validation
    if (!payload.trader || !payload.trader.startsWith('0x')) {
      errors.push('Invalid trader address');
    }

    if (payload.assetId < 0 || payload.assetId > 4) {
      errors.push('Invalid asset ID (must be 0-4)');
    }

    const qty = BigInt(payload.qty);
    if (qty <= 0n) {
      errors.push('Position size must be positive');
    }

    const margin = BigInt(payload.margin);
    if (margin <= 0n) {
      errors.push('Margin must be positive');
    }

    // Size limits
    const minSize = 10n * 10n ** 6n; // $10 minimum
    const maxSize = 100000n * 10n ** 6n; // $100k maximum

    if (qty > maxSize) {
      errors.push(`Position too large: $${Number(qty)/1e6} > $${Number(maxSize)/1e6}`);
    }

    // Leverage check
    const leverage = Number(qty) / Number(margin);
    if (leverage > 10) {
      errors.push(`Leverage too high: ${leverage.toFixed(2)}x > 10x`);
    }

    // Trade age check
    const tradeAge = Date.now() - payload.timestamp;
    if (tradeAge > 120000) { // 2 minutes
      errors.push(`Trade too old: ${Math.floor(tradeAge/1000)}s > 120s`);
    }

    // Check if asset is paused
    try {
      const isPaused = await contractManager.isAssetPaused(payload.assetId);
      if (isPaused) {
        errors.push(`Asset ${payload.assetId} is currently paused`);
      }
    } catch (error) {
      console.warn('Could not check asset pause status');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  private async calculateAndValidateFees(payload: TradePayload): Promise<{
    success: boolean;
    fees?: {
      openingFee: bigint;
      totalFees: bigint;
      netMargin: bigint;
    };
    error?: string;
  }> {
    try {
      const fees = feeCalculator.calculateNewPositionFees(
        BigInt(payload.qty),
        BigInt(payload.margin),
        payload.isLong
      );

      // 🔧 Check if user has sufficient balance for TOTAL margin (not just available)
      const userBalance = database.getUserBalance(payload.trader);
      if (userBalance.available < BigInt(payload.margin)) {
        return {
          success: false,
          error: `Insufficient balance: $${Number(userBalance.available)/1e6} < $${Number(BigInt(payload.margin))/1e6}`
        };
      }

      return {
        success: true,
        fees: {
          openingFee: fees.openingFee,
          totalFees: fees.totalFees,
          netMargin: fees.netMargin
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Fee calculation failed'
      };
    }
  }

  private calculateAssetDeltas(trades: ProcessedTrade[]): Map<number, {
    netQtyDelta: bigint;
    netMarginDelta: bigint;
    trades: ProcessedTrade[];
  }> {
    console.log('📊 Calculating net deltas per asset...');
    
    const assetDeltas = new Map<number, {
      netQtyDelta: bigint;
      netMarginDelta: bigint;
      trades: ProcessedTrade[];
    }>();

    for (const trade of trades) {
      if (!assetDeltas.has(trade.assetId)) {
        assetDeltas.set(trade.assetId, {
          netQtyDelta: 0n,
          netMarginDelta: 0n,
          trades: []
        });
      }

      const data = assetDeltas.get(trade.assetId)!;
      
      // Net quantity: positive for long, negative for short
      const signedQty = trade.isLong ? trade.qty : -trade.qty;
      data.netQtyDelta += signedQty;
      
      // 🔧 Net margin: use the net margin that's actually locked
      data.netMarginDelta += trade.fees?.netMargin || 0n;
      
      data.trades.push(trade);
    }

    // Log deltas
    for (const [assetId, data] of assetDeltas) {
      console.log(`   Asset ${assetId}: netQty=${this.formatDelta(data.netQtyDelta)}, netMargin=$${Number(data.netMarginDelta)/1e6}`);
    }

    return assetDeltas;
  }

  private async updatePositionsAndMerkleTree(trades: ProcessedTrade[]): Promise<{
    oldRoot: string;
    newRoot: string;
  }> {
    console.log('🌳 Updating positions and merkle tree...');
    
    const contractRoot = await contractManager.getCurrentRoot(0);
    console.log(`📋 Contract root: ${contractRoot}`);
    
    const localOldRoot = merkleTree.getCurrentRootHex();
    console.log(`📋 Local root: ${localOldRoot}`);
    
    if (contractRoot.toLowerCase() !== localOldRoot.toLowerCase()) {
      console.log(`⚠️ Root mismatch detected - syncing to contract root`);
    }
    
    // Update positions
    for (const trade of trades) {
      const currentPrice = await contractManager.getCurrentPrice(trade.assetId);
      
      const position: Position = {
        trader: trade.trader,
        assetId: trade.assetId,
        size: trade.isLong ? trade.qty : -trade.qty,
        margin: trade.fees?.netMargin || trade.margin, // 🔧 Store the actual locked margin
        entryPrice: currentPrice,
        lastUpdate: Date.now()
      };

      merkleTree.updatePosition(position);
    }

    const newRoot = merkleTree.getCurrentRootHex();
    
    console.log(`✅ Updated ${trades.length} positions`);
    console.log(`🌳 Root transition: ${contractRoot.substring(0, 10)}... → ${newRoot.substring(0, 10)}...`);

    return { 
      oldRoot: contractRoot,
      newRoot: newRoot 
    };
  }

  private async submitBatchToContract(
    assetDeltas: Map<number, any>,
    oldRoot: string,
    newRoot: string
  ): Promise<string> {
    console.log('📤 Submitting batch to contract...');
    
    const assetIds: number[] = [];
    const netDeltas: bigint[] = [];
    const marginDeltas: bigint[] = [];
    const oldRoots: string[] = [];
    const newRoots: string[] = [];

    for (const [assetId, data] of assetDeltas) {
      const contractRoot = await contractManager.getCurrentRoot(assetId);
      
      assetIds.push(assetId);
      netDeltas.push(data.netQtyDelta);
      marginDeltas.push(data.netMarginDelta);
      oldRoots.push(contractRoot);
      newRoots.push(newRoot);
      
      console.log(`📋 Asset ${assetId}: Contract root=${contractRoot.substring(0, 10)}..., New root=${newRoot.substring(0, 10)}...`);
    }

    const txHash = await contractManager.processBatch(
      assetIds,
      oldRoots,
      newRoots,
      netDeltas,
      marginDeltas
    );
    
    console.log(`✅ Contract call successful: ${txHash}`);
    return txHash;
  }

  // ====================================================================
  // UTILITIES
  // ====================================================================

  async forceBatchProcessing(): Promise<BatchResult | null> {
    console.log('🚀 Force processing batch...');
    return await this.processBatch();
  }

  private startBatchTimer(): void {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
    }

    this.batchTimer = setTimeout(() => {
      if (this.pendingTrades.length > 0 && !this.processingBatch) {
        console.log('⏰ Batch timeout reached, processing pending trades...');
        this.processBatch();
      } else {
        this.startBatchTimer();
      }
    }, this.BATCH_TIMEOUT);
  }

  private createFailedTrade(
    tradeId: string, 
    error: string, 
    payload?: TradePayload
  ): ProcessedTrade {
    return {
      tradeId,
      trader: payload?.trader || '',
      assetId: payload?.assetId || 0,
      qty: payload ? BigInt(payload.qty) : 0n,
      margin: payload ? BigInt(payload.margin) : 0n,
      isLong: payload?.isLong || true,
      timestamp: payload?.timestamp || Date.now(),
      isValid: false,
      errors: [error]
    };
  }

  private generateTradeId(): string {
    this.tradeCounter++;
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `trade_${timestamp}_${this.tradeCounter}_${random}`;
  }

  private generateBatchId(): string {
    this.batchCounter++;
    const timestamp = Date.now();
    return `batch_${timestamp}_${this.batchCounter}`;
  }

  private formatDelta(delta: bigint): string {
    const abs = delta < 0n ? -delta : delta;
    const sign = delta < 0n ? '-' : '+';
    return `${sign}$${Number(abs)/1e6}`;
  }

  getPendingTrades(): ProcessedTrade[] {
    return [...this.pendingTrades];
  }

  getStats(): {
    pendingTrades: number;
    totalProcessed: number;
    totalBatches: number;
    isProcessing: boolean;
    nextBatchIn: number;
  } {
    const nextBatchIn = this.batchTimer ? this.BATCH_TIMEOUT : 0;
    
    return {
      pendingTrades: this.pendingTrades.length,
      totalProcessed: this.tradeCounter,
      totalBatches: this.batchCounter,
      isProcessing: this.processingBatch,
      nextBatchIn
    };
  }

  clear(): void {
    this.pendingTrades = [];
    this.tradeCounter = 0;
    this.batchCounter = 0;
    
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
    }
    
    this.startBatchTimer();
    console.log('🧹 Executor cleared');
  }
}

export const executor = new MinimalExecutor();