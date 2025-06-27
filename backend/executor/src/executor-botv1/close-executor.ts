// close-executor.ts
import { cryptoManager, ClosePositionPayload, EncryptedData } from './crypto';
import { database, Position } from './database';
import { feeCalculator } from './fees';
import { merkleTree } from './merkle';
import { contractManager } from './contracts';

// ====================================================================
// CLOSE TRADE EXECUTOR - POSITION CLOSING & PNL MANAGEMENT
// ====================================================================

export interface ProcessedClose {
  closeId: string;
  trader: string;
  assetId: number;
  closePercent: number;
  originalPosition: Position;
  marketData: {
    entryPrice: bigint;
    currentPrice: bigint;
    priceChange: number; // Percentage
  };
  pnl: {
    unrealizedPnL: bigint;
    closingFees: bigint;
    netPayout: bigint;
  };
  position: {
    originalSize: bigint;
    closeSize: bigint;
    remainingSize: bigint;
    isFullClose: boolean;
  };
  isValid: boolean;
  errors?: string[];
  timestamp: number;
}

export interface CloseBatchResult {
  batchId: string;
  processedCloses: number;
  totalPnL: bigint;
  totalFees: bigint;
  totalPayout: bigint;
  affectedAssets: number[];
  oldRoot: string;
  newRoot: string;
  txHash: string;
  success: boolean;
  error?: string;
  timestamp: number;
}

export interface PnLCalculation {
  trader: string;
  assetId?: number;
  totalUnrealizedPnL: bigint;
  totalClosingFees: bigint;
  netPnL: bigint;
  positions: Array<{
    assetId: number;
    size: bigint;
    entryPrice: bigint;
    currentPrice: bigint;
    unrealizedPnL: bigint;
    closingFees: bigint;
    netPnL: bigint;
    pnlPercent: number;
    isLong: boolean;
    healthFactor: number;
  }>;
}

export class CloseTradeExecutor {
  private pendingCloses: ProcessedClose[] = [];
  private processingBatch = false;
  private closeCounter = 0;
  private batchCounter = 0;
  
  // Configuration
  private readonly BATCH_SIZE = 3; // Process every 3 closes
  private readonly BATCH_TIMEOUT = 20000; // Or every 20 seconds
  private batchTimer: NodeJS.Timeout | null = null;

  constructor() {
    console.log('🔄 Close Trade Executor initializing...');
    
    // Start batch timer
    this.startBatchTimer();
    
    console.log('✅ Close Trade Executor initialized');
    console.log(`⚙️ Close batch size: ${this.BATCH_SIZE} operations`);
    console.log(`⏰ Close batch timeout: ${this.BATCH_TIMEOUT / 1000}s`);
  }

  // ====================================================================
  // CLOSE PROCESSING
  // ====================================================================

  /**
   * Process encrypted close request
   */
  async processEncryptedClose(encryptedData: EncryptedData): Promise<ProcessedClose> {
    const closeId = this.generateCloseId();
    console.log(`\n🔄 Processing encrypted close: ${closeId}`);

    try {
      // Step 1: Decrypt and verify
      const decryptedClose = await cryptoManager.processEncryptedClose(encryptedData);
      
      if (!decryptedClose.isValid) {
        return this.createFailedClose(closeId, decryptedClose.error || 'Decryption failed');
      }

      const { payload } = decryptedClose;

      // Step 2: Validate close request
      const validationResult = await this.validateCloseRequest(payload);
      if (!validationResult.isValid) {
        return this.createFailedClose(closeId, validationResult.errors.join(', '), payload);
      }

      const { position } = validationResult;

      // Step 3: Calculate PnL and market data
      const pnlResult = await this.calculateDetailedPnL(position!, payload.closePercent);
      if (!pnlResult.success) {
        return this.createFailedClose(closeId, pnlResult.error!, payload);
      }

      // Step 4: Process the close (update position and balance)
      const closeResult = await this.executeClose(position!, payload, pnlResult.data!);
      if (!closeResult.success) {
        return this.createFailedClose(closeId, closeResult.error!, payload);
      }

      // Step 5: Create successful close record
      const processedClose: ProcessedClose = {
        closeId,
        trader: payload.trader,
        assetId: payload.assetId,
        closePercent: payload.closePercent,
        originalPosition: position!,
        marketData: pnlResult.data!.marketData,
        pnl: pnlResult.data!.pnl,
        position: pnlResult.data!.position,
        isValid: true,
        timestamp: Date.now()
      };

      // Step 6: Add to pending operations
      this.pendingCloses.push(processedClose);
      
      console.log(`✅ Close ${closeId} processed successfully`);
      console.log(`📊 ${payload.trader} closed ${payload.closePercent}% of asset ${payload.assetId}`);
      console.log(`💰 PnL: ${this.formatPnL(pnlResult.data!.pnl.unrealizedPnL)}`);
      console.log(`💸 Net payout: ${this.formatPnL(pnlResult.data!.pnl.netPayout)}`);
      console.log(`📋 Pending closes: ${this.pendingCloses.length}/${this.BATCH_SIZE}`);

      // Step 7: Check if we should process batch
      if (this.pendingCloses.length >= this.BATCH_SIZE) {
        console.log('🚀 Close batch size reached, processing immediately...');
        setTimeout(() => this.processCloseBatch(), 100);
      }

      return processedClose;

    } catch (error) {
      console.error(`❌ Close processing failed for ${closeId}:`, error);
      return this.createFailedClose(closeId, error instanceof Error ? error.message : 'Unknown error');
    }
  }

  // ====================================================================
  // PNL CALCULATION
  // ====================================================================

  /**
   * Calculate current PnL for user positions
   */
  async calculateCurrentPnL(trader: string, assetId?: number): Promise<PnLCalculation> {
    console.log(`📊 Calculating PnL for trader: ${trader}${assetId !== undefined ? ` asset: ${assetId}` : ''}`);
    
    // Get user positions
    const positions = assetId !== undefined 
      ? database.getTraderPositions(trader).filter(p => p.assetId === assetId)
      : database.getTraderPositions(trader);
    
    if (positions.length === 0) {
      return {
        trader,
        assetId,
        totalUnrealizedPnL: 0n,
        totalClosingFees: 0n,
        netPnL: 0n,
        positions: []
      };
    }
    
    let totalUnrealizedPnL = 0n;
    let totalClosingFees = 0n;
    
    const positionPnLs = [];
    
    for (const position of positions) {
      try {
        const pnlData = await this.calculatePositionPnL(position);
        
        positionPnLs.push({
          assetId: position.assetId,
          size: position.size,
          entryPrice: position.entryPrice,
          currentPrice: pnlData.currentPrice,
          unrealizedPnL: pnlData.unrealizedPnL,
          closingFees: pnlData.closingFees,
          netPnL: pnlData.netPnL,
          pnlPercent: pnlData.pnlPercent,
          isLong: position.size > 0n,
          healthFactor: pnlData.healthFactor
        });
        
        totalUnrealizedPnL += pnlData.unrealizedPnL;
        totalClosingFees += pnlData.closingFees;
        
      } catch (error) {
        console.error(`❌ Failed to calculate PnL for position ${trader}-${position.assetId}:`, error);
      }
    }
    
    const netPnL = totalUnrealizedPnL - totalClosingFees;
    
    console.log(`📊 Total unrealized PnL: ${this.formatPnL(totalUnrealizedPnL)}`);
    console.log(`📊 Total closing fees: ${this.formatUSDC(totalClosingFees)}`);
    console.log(`📊 Net PnL: ${this.formatPnL(netPnL)}`);
    
    return {
      trader,
      assetId,
      totalUnrealizedPnL,
      totalClosingFees,
      netPnL,
      positions: positionPnLs
    };
  }

  /**
   * Calculate PnL for a single position
   */
  async calculatePositionPnL(position: Position): Promise<{
    currentPrice: bigint;
    unrealizedPnL: bigint;
    closingFees: bigint;
    netPnL: bigint;
    pnlPercent: number;
    healthFactor: number;
  }> {
    const currentPrice = await contractManager.getCurrentPrice(position.assetId);
    const isLong = position.size > 0n;
    const absSize = isLong ? position.size : -position.size;
    
    // Calculate unrealized PnL
    let unrealizedPnL: bigint;
    if (isLong) {
      // Long: profit when price goes up
      unrealizedPnL = (absSize * (currentPrice - position.entryPrice)) / position.entryPrice;
    } else {
      // Short: profit when price goes down
      unrealizedPnL = (absSize * (position.entryPrice - currentPrice)) / position.entryPrice;
    }
    
    // Calculate closing fees
    const closingFees = feeCalculator.calculateClosingFee(absSize);
    
    // Net PnL after fees
    const netPnL = unrealizedPnL - closingFees;
    
    // PnL percentage (based on margin)
    const pnlPercent = Number((unrealizedPnL * 10000n) / position.margin) / 100;
    
    // Health factor (margin + PnL) / margin
    const healthFactor = Number((position.margin + unrealizedPnL) * 100n / position.margin) / 100;
    
    return {
      currentPrice,
      unrealizedPnL,
      closingFees,
      netPnL,
      pnlPercent,
      healthFactor
    };
  }

  /**
   * Calculate detailed PnL for closing operations
   */
  private async calculateDetailedPnL(
    position: Position, 
    closePercent: number
  ): Promise<{
    success: boolean;
    data?: {
      marketData: {
        entryPrice: bigint;
        currentPrice: bigint;
        priceChange: number;
      };
      pnl: {
        unrealizedPnL: bigint;
        closingFees: bigint;
        netPayout: bigint;
      };
      position: {
        originalSize: bigint;
        closeSize: bigint;
        remainingSize: bigint;
        isFullClose: boolean;
      };
    };
    error?: string;
  }> {
    try {
      const currentPrice = await contractManager.getCurrentPrice(position.assetId);
      const isLong = position.size > 0n;
      const absSize = isLong ? position.size : -position.size;
      const closeSize = (absSize * BigInt(closePercent)) / 100n;
      const remainingSize = absSize - closeSize;
      const isFullClose = closePercent >= 100;
      
      // Calculate price change percentage
      const priceChange = Number((currentPrice - position.entryPrice) * 10000n / position.entryPrice) / 100;
      
      // Calculate PnL on the closing portion
      let unrealizedPnL: bigint;
      if (isLong) {
        unrealizedPnL = (closeSize * (currentPrice - position.entryPrice)) / position.entryPrice;
      } else {
        unrealizedPnL = (closeSize * (position.entryPrice - currentPrice)) / position.entryPrice;
      }
      
      // Calculate closing fees
      const closingFees = feeCalculator.calculateClosingFee(closeSize);
      
      // Calculate net payout
      const netPayout = unrealizedPnL - closingFees;
      
      console.log(`📊 Detailed PnL calculation:`);
      console.log(`   Original size: ${this.formatUSDC(absSize)}`);
      console.log(`   Close size: ${this.formatUSDC(closeSize)} (${closePercent}%)`);
      console.log(`   Entry price: ${this.formatPrice(position.entryPrice)}`);
      console.log(`   Current price: ${this.formatPrice(currentPrice)}`);
      console.log(`   Price change: ${priceChange > 0 ? '+' : ''}${priceChange.toFixed(2)}%`);
      console.log(`   Unrealized PnL: ${this.formatPnL(unrealizedPnL)}`);
      console.log(`   Closing fees: ${this.formatUSDC(closingFees)}`);
      console.log(`   Net payout: ${this.formatPnL(netPayout)}`);
      
      return {
        success: true,
        data: {
          marketData: {
            entryPrice: position.entryPrice,
            currentPrice,
            priceChange
          },
          pnl: {
            unrealizedPnL,
            closingFees,
            netPayout
          },
          position: {
            originalSize: position.size,
            closeSize: isLong ? closeSize : -closeSize,
            remainingSize: isLong ? remainingSize : -remainingSize,
            isFullClose
          }
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'PnL calculation failed'
      };
    }
  }

  // ====================================================================
  // CLOSE EXECUTION
  // ====================================================================

  private async executeClose(
    position: Position,
    payload: ClosePositionPayload,
    pnlData: any
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Step 1: Update user balance with PnL
      const balanceSuccess = database.addBalance(payload.trader, pnlData.pnl.netPayout);
      if (!balanceSuccess) {
        return { success: false, error: 'Failed to update user balance with PnL' };
      }
      
      // Step 2: Update position size or remove position
      let positionSuccess: boolean;
      
      if (pnlData.position.isFullClose) {
        // Full close: remove position entirely
        positionSuccess = this.removePosition(payload.trader, payload.assetId);
      } else {
        // Partial close: update position size
        positionSuccess = this.updatePositionSize(
          payload.trader, 
          payload.assetId, 
          pnlData.position.remainingSize
        );
      }
      
      if (!positionSuccess) {
        // Rollback balance change
        database.addBalance(payload.trader, BigInt(-pnlData.pnl.netPayout));
        return { success: false, error: 'Failed to update position' };
      }
      
      console.log(`✅ Close executed: ${pnlData.position.isFullClose ? 'Full' : 'Partial'} close completed`);
      return { success: true };
      
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Close execution failed' 
      };
    }
  }

  private removePosition(trader: string, assetId: number): boolean {
    try {
      // Remove from database
      const key = `${trader.toLowerCase()}-${assetId}`;
      const dbData = (database as any).data;
      if (dbData.positions[key]) {
        delete dbData.positions[key];
        (database as any).saveToBackup();
      }
      
      // Remove from merkle tree (sets to zero)
      merkleTree.removePosition(trader, assetId);
      
      console.log(`🗑️ Position fully closed and removed: ${trader} asset ${assetId}`);
      return true;
    } catch (error) {
      console.error('Failed to remove position:', error);
      return false;
    }
  }

  private updatePositionSize(trader: string, assetId: number, newSize: bigint): boolean {
    try {
      const position = database.getPosition(trader, assetId);
      if (!position) return false;
      
      // Update position with new size
      const updatedPosition: Position = {
        ...position,
        size: newSize,
        lastUpdate: Date.now()
      };
      
      database.savePosition(updatedPosition);
      merkleTree.updatePosition(updatedPosition);
      
      console.log(`📏 Position size updated: ${trader} asset ${assetId} new size: ${this.formatUSDC(newSize < 0n ? -newSize : newSize)}`);
      return true;
    } catch (error) {
      console.error('Failed to update position size:', error);
      return false;
    }
  }

  // ====================================================================
  // CLOSE VALIDATION
  // ====================================================================

  private async validateCloseRequest(payload: ClosePositionPayload): Promise<{
    isValid: boolean;
    errors: string[];
    position?: Position;
  }> {
    const errors: string[] = [];

    // Basic validation
    if (!payload.trader || !payload.trader.startsWith('0x')) {
      errors.push('Invalid trader address');
    }

    if (payload.assetId < 0 || payload.assetId > 4) {
      errors.push('Invalid asset ID (must be 0-4)');
    }

    if (payload.closePercent <= 0 || payload.closePercent > 100) {
      errors.push('Invalid close percent (must be 1-100)');
    }

    // Check if position exists
    const position = database.getPosition(payload.trader, payload.assetId);
    if (!position) {
      errors.push('Position not found');
      return { isValid: false, errors };
    }

    // Check if position has size
    if (position.size === 0n) {
      errors.push('Position has zero size');
    }

    // Check request age
    const requestAge = Date.now() - payload.timestamp;
    if (requestAge > 120000) { // 2 minutes
      errors.push(`Close request too old: ${Math.floor(requestAge/1000)}s > 120s`);
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
      errors,
      position: errors.length === 0 ? position : undefined
    };
  }

  // ====================================================================
  // BATCH PROCESSING WITH CONTRACT INTEGRATION
  // ====================================================================

  async processCloseBatch(): Promise<CloseBatchResult | null> {
    if (this.processingBatch || this.pendingCloses.length === 0) {
      return null;
    }

    this.processingBatch = true;
    const batchId = this.generateBatchId();
    
    console.log(`\n🏭 Processing close batch ${batchId} with ${this.pendingCloses.length} closes`);

    const closes = [...this.pendingCloses];
    this.pendingCloses = [];

    try {
      // Step 1: Calculate net deltas for contract submission
      const contractDeltas = this.calculateContractDeltas(closes);
      
      // Step 2: Submit to contract (which will call applyNetDelta with negative margins)
      const txHash = await this.submitCloseBatchToContract(contractDeltas);
      
      // Step 3: Contract releases funds to executor via pool.releaseTo(executor, amount)
      console.log(`💰 Contract released funds to executor via transaction: ${txHash}`);
      
      // Calculate totals for result
      const totalPnL = closes.reduce((sum, close) => sum + close.pnl.unrealizedPnL, 0n);
      const totalFees = closes.reduce((sum, close) => sum + close.pnl.closingFees, 0n);
      const totalPayout = closes.reduce((sum, close) => sum + close.pnl.netPayout, 0n);
      const affectedAssets = [...new Set(closes.map(c => c.assetId))];

      const oldRoot = merkleTree.getCurrentRootHex();
      const newRoot = merkleTree.getCurrentRootHex(); // Already updated during individual closes

      const result: CloseBatchResult = {
        batchId,
        processedCloses: closes.length,
        totalPnL,
        totalFees,
        totalPayout,
        affectedAssets,
        oldRoot,
        newRoot,
        txHash,
        success: true,
        timestamp: Date.now()
      };

      console.log(`✅ Close batch ${batchId} processed successfully: ${txHash}`);
      console.log(`📊 Released ${this.formatPnL(totalPayout)} to users via contract`);

      return result;

    } catch (error) {
      console.error(`❌ Close batch ${batchId} failed:`, error);
      
      // Rollback: Add closes back to pending
      this.pendingCloses.unshift(...closes);
      
      // TODO: Rollback individual close operations if needed
      console.log('⚠️ Individual closes already processed - may need manual reconciliation');
      
      return {
        batchId,
        processedCloses: 0,
        totalPnL: 0n,
        totalFees: 0n,
        totalPayout: 0n,
        affectedAssets: [],
        oldRoot: merkleTree.getCurrentRootHex(),
        newRoot: merkleTree.getCurrentRootHex(),
        txHash: '',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now()
      };

    } finally {
      this.processingBatch = false;
      this.startBatchTimer();
    }
  }

  // ====================================================================
  // CONTRACT INTEGRATION METHODS
  // ====================================================================

  private calculateContractDeltas(closes: ProcessedClose[]): Map<number, {
    netQtyDelta: bigint;
    netMarginDelta: bigint;
  }> {
    console.log('📊 Calculating contract deltas for closes...');
    
    const deltas = new Map<number, {
      netQtyDelta: bigint;
      netMarginDelta: bigint;
    }>();

    for (const close of closes) {
      if (!deltas.has(close.assetId)) {
        deltas.set(close.assetId, {
          netQtyDelta: 0n,
          netMarginDelta: 0n
        });
      }

      const data = deltas.get(close.assetId)!;
      
      // NEGATIVE qty delta (removing position)
      data.netQtyDelta += close.position.closeSize; // closeSize is already signed (negative for shorts)
      
      // NEGATIVE margin delta (releasing funds)
      // Release original margin + PnL payout
      const marginToRelease = close.originalPosition.margin + close.pnl.netPayout;
      data.netMarginDelta -= marginToRelease; // NEGATIVE = withdrawal
    }

    // Log what we're sending to contract
    for (const [assetId, data] of deltas) {
      console.log(`   Asset ${assetId}:`);
      console.log(`     Qty delta: ${this.formatPnL(data.netQtyDelta)} (removing positions)`);
      console.log(`     Margin delta: ${this.formatPnL(data.netMarginDelta)} (NEGATIVE = fund release)`);
    }

    return deltas;
  }

  private async submitCloseBatchToContract(
    deltas: Map<number, { netQtyDelta: bigint; netMarginDelta: bigint }>
  ): Promise<string> {
    console.log('📤 Submitting close batch to contract...');
    
    const assetIds: number[] = [];
    const netDeltas: bigint[] = [];
    const marginDeltas: bigint[] = [];
    const oldRoots: string[] = [];
    const newRoots: string[] = [];

    const newRoot = merkleTree.getCurrentRootHex();

    for (const [assetId, data] of deltas) {
      const contractRoot = await contractManager.getCurrentRoot(assetId);
      
      assetIds.push(assetId);
      netDeltas.push(data.netQtyDelta);
      marginDeltas.push(data.netMarginDelta); // NEGATIVE values trigger withdrawal
      oldRoots.push(contractRoot);
      newRoots.push(newRoot);
      
      console.log(`📋 Asset ${assetId}:`);
      console.log(`   Contract root: ${contractRoot.substring(0, 10)}...`);
      console.log(`   New root: ${newRoot.substring(0, 10)}...`);
      console.log(`   Releasing: ${this.formatUSDC(-data.netMarginDelta)} to executor`);
    }

    // This calls PerpEngineZK.processBatch → PerpEngine.applyNetDelta → pool.releaseTo(executor)
    // The key is that negative marginDeltas trigger the withdrawal logic!
    const txHash = await contractManager.processBatch(
      assetIds,
      oldRoots,
      newRoots,
      netDeltas,
      marginDeltas // NEGATIVE values = withdrawals!
    );
    
    console.log(`✅ Contract will release funds to executor: ${txHash}`);
    return txHash;
  }

  // ====================================================================
  // BATCH TIMER
  // ====================================================================

  private startBatchTimer(): void {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
    }

    this.batchTimer = setTimeout(() => {
      if (this.pendingCloses.length > 0 && !this.processingBatch) {
        console.log('⏰ Close batch timeout reached, processing pending closes...');
        this.processCloseBatch();
      } else {
        this.startBatchTimer();
      }
    }, this.BATCH_TIMEOUT);
  }

  // ====================================================================
  // UTILITIES
  // ====================================================================

  private createFailedClose(
    closeId: string,
    error: string,
    payload?: ClosePositionPayload
  ): ProcessedClose {
    return {
      closeId,
      trader: payload?.trader || '',
      assetId: payload?.assetId || 0,
      closePercent: payload?.closePercent || 0,
      originalPosition: {} as Position,
      marketData: {
        entryPrice: 0n,
        currentPrice: 0n,
        priceChange: 0
      },
      pnl: {
        unrealizedPnL: 0n,
        closingFees: 0n,
        netPayout: 0n
      },
      position: {
        originalSize: 0n,
        closeSize: 0n,
        remainingSize: 0n,
        isFullClose: false
      },
      isValid: false,
      errors: [error],
      timestamp: Date.now()
    };
  }

  private generateCloseId(): string {
    this.closeCounter++;
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `close_${timestamp}_${this.closeCounter}_${random}`;
  }

  private generateBatchId(): string {
    this.batchCounter++;
    const timestamp = Date.now();
    return `close_batch_${timestamp}_${this.batchCounter}`;
  }

  private formatUSDC(amount: bigint): string {
    const abs = amount < 0n ? -amount : amount;
    return `$${(Number(abs) / 1e6).toFixed(2)}`;
  }

  private formatPnL(amount: bigint): string {
    const abs = amount < 0n ? -amount : amount;
    const sign = amount < 0n ? '-' : '+';
    return `${sign}$${(Number(abs) / 1e6).toFixed(2)}`;
  }

  private formatPrice(price: bigint): string {
    return `$${(Number(price) / 1e18).toFixed(2)}`;
  }

  // ====================================================================
  // PUBLIC QUERIES
  // ====================================================================

  /**
   * Get pending closes
   */
  getPendingCloses(): ProcessedClose[] {
    return [...this.pendingCloses];
  }

  /**
   * Force close batch processing
   */
  async forceCloseBatchProcessing(): Promise<CloseBatchResult | null> {
    console.log('🚀 Force processing close batch...');
    return await this.processCloseBatch();
  }

  /**
   * Get executor statistics
   */
  getStats(): {
    pendingCloses: number;
    totalProcessed: number;
    totalBatches: number;
    isProcessing: boolean;
    nextBatchIn: number;
  } {
    const nextBatchIn = this.batchTimer ? this.BATCH_TIMEOUT : 0;
    
    return {
      pendingCloses: this.pendingCloses.length,
      totalProcessed: this.closeCounter,
      totalBatches: this.batchCounter,
      isProcessing: this.processingBatch,
      nextBatchIn
    };
  }

  /**
   * Clear all data (for testing)
   */
  clear(): void {
    this.pendingCloses = [];
    this.closeCounter = 0;
    this.batchCounter = 0;
    
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
    }
    
    this.startBatchTimer();
    console.log('🧹 Close executor cleared');
  }
}

// Export singleton instance
export const closeExecutor = new CloseTradeExecutor();