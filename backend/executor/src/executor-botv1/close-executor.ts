// FIXED CLOSE EXECUTOR - PROPER MARGIN RELEASE
// Key changes marked with 🔧

import { cryptoManager, ClosePositionPayload, EncryptedData } from './crypto';
import { database, Position } from './database';
import { feeCalculator } from './fees';
import { merkleTree } from './merkle';
import { contractManager } from './contracts';

export interface ProcessedClose {
  closeId: string;
  trader: string;
  assetId: number;
  closePercent: number;
  originalPosition: Position;
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
  // 🔧 Add margin tracking for proper balance management
  margin: {
    originalMargin: bigint;
    marginToRelease: bigint;
    remainingMargin: bigint;
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
  
  private readonly BATCH_SIZE = 3;
  private readonly BATCH_TIMEOUT = 20000;
  private batchTimer: NodeJS.Timeout | null = null;

  constructor() {
    console.log('🔄 Close Trade Executor initializing...');
    this.startBatchTimer();
    console.log('✅ Close Trade Executor initialized');
    console.log(`⚙️ Close batch size: ${this.BATCH_SIZE} operations`);
    console.log(`⏰ Close batch timeout: ${this.BATCH_TIMEOUT / 1000}s`);
  }

  // ====================================================================
  // 🔧 FIXED CLOSE PROCESSING - PROPER MARGIN HANDLING
  // ====================================================================

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

      // 🔧 Step 4: NEW CLEAN FLOW - Process close with proper margin handling
      const closeResult = await this.executeCloseWithMarginHandling(position!, payload, pnlResult.data!);
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
        // 🔧 Add margin tracking
        margin: closeResult.marginData!,
        isValid: true,
        timestamp: Date.now()
      };

      // Step 6: Add to pending operations
      this.pendingCloses.push(processedClose);
      
      console.log(`✅ Close ${closeId} processed successfully`);
      console.log(`📊 ${payload.trader} closed ${payload.closePercent}% of asset ${payload.assetId}`);
      console.log(`💰 PnL: ${this.formatPnL(pnlResult.data!.pnl.unrealizedPnL)}`);
      console.log(`💸 Net payout: ${this.formatPnL(pnlResult.data!.pnl.netPayout)}`);
      console.log(`🔓 Margin released: $${Number(closeResult.marginData!.marginToRelease)/1e6}`);
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
  // 🔧 NEW CLOSE EXECUTION WITH PROPER MARGIN HANDLING
  // ====================================================================

  private async executeCloseWithMarginHandling(
    position: Position,
    payload: ClosePositionPayload,
    pnlData: any
  ): Promise<{ 
    success: boolean; 
    error?: string;
    marginData?: {
      originalMargin: bigint;
      marginToRelease: bigint;
      remainingMargin: bigint;
    };
  }> {
    try {
      const isFullClose = payload.closePercent >= 100;
      
      // 🔧 Calculate margin allocation
      const originalMargin = position.margin;
      const marginToRelease = isFullClose 
        ? originalMargin 
        : (originalMargin * BigInt(payload.closePercent)) / 100n;
      const remainingMargin = originalMargin - marginToRelease;

      console.log(`💰 Margin calculation:`);
      console.log(`   Original margin: $${Number(originalMargin)/1e6}`);
      console.log(`   Margin to release: $${Number(marginToRelease)/1e6}`);
      console.log(`   Remaining margin: $${Number(remainingMargin)/1e6}`);

      // 🔧 Step 1: Unlock the margin portion being closed
      const marginUnlocked = database.unlockBalance(payload.trader, marginToRelease);
      if (!marginUnlocked) {
        return { success: false, error: 'Failed to unlock position margin' };
      }
      console.log(`🔓 Unlocked $${Number(marginToRelease)/1e6} margin`);

      // 🔧 Step 2: Add PnL to available balance (can be positive or negative)
      const pnlAdded = database.addBalance(payload.trader, pnlData.pnl.netPayout);
      if (!pnlAdded) {
        // Rollback margin unlock
        database.lockBalance(payload.trader, marginToRelease);
        return { success: false, error: 'Failed to add PnL to balance' };
      }
      console.log(`💰 Added PnL: ${this.formatPnL(pnlData.pnl.netPayout)}`);

      // 🔧 Step 3: Update or remove position
      let positionUpdated: boolean;
      
      if (isFullClose) {
        // Full close: remove position entirely
        positionUpdated = this.removePosition(payload.trader, payload.assetId);
        console.log(`🗑️ Position fully closed and removed`);
      } else {
        // Partial close: update position size and margin
        const updatedPosition: Position = {
          ...position,
          size: pnlData.position.remainingSize,
          margin: remainingMargin, // 🔧 Update margin to remaining amount
          lastUpdate: Date.now()
        };
        positionUpdated = this.updatePosition(updatedPosition);
        console.log(`📏 Position partially closed and updated`);
      }
      
      if (!positionUpdated) {
        // Rollback balance changes
        database.addBalance(payload.trader, 0n - pnlData.pnl.netPayout); // 🔧 Fix bigint negation
        database.lockBalance(payload.trader, marginToRelease);
        return { success: false, error: 'Failed to update position' };
      }

      // 🔧 Step 4: Verify final balance state
      const finalBalance = database.getUserBalance(payload.trader);
      console.log(`✅ Final balance state:`);
      console.log(`   Available: $${Number(finalBalance.available)/1e6}`);
      console.log(`   Locked: $${Number(finalBalance.locked)/1e6}`);
      console.log(`   Total: $${Number(finalBalance.total)/1e6}`);

      return { 
        success: true,
        marginData: {
          originalMargin,
          marginToRelease,
          remainingMargin
        }
      };
      
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Close execution failed' 
      };
    }
  }

  // ====================================================================
  // 🔧 IMPROVED POSITION MANAGEMENT
  // ====================================================================

  private updatePosition(position: Position): boolean {
    try {
      // Save to database
      database.savePosition(position);
      
      // Update in merkle tree
      merkleTree.updatePosition(position);
      
      console.log(`📊 Position updated: ${position.trader} asset ${position.assetId}`);
      console.log(`   New size: ${this.formatPosition(position)}`);
      console.log(`   New margin: $${Number(position.margin)/1e6}`);
      
      return true;
    } catch (error) {
      console.error('Failed to update position:', error);
      return false;
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

  // ====================================================================
  // PNL CALCULATION (UNCHANGED)
  // ====================================================================

  async calculateCurrentPnL(trader: string, assetId?: number): Promise<PnLCalculation> {
    console.log(`📊 Calculating PnL for trader: ${trader}${assetId !== undefined ? ` asset: ${assetId}` : ''}`);
    
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
      unrealizedPnL = (absSize * (currentPrice - position.entryPrice)) / position.entryPrice;
    } else {
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
  // VALIDATION (UNCHANGED)
  // ====================================================================

  private async validateCloseRequest(payload: ClosePositionPayload): Promise<{
    isValid: boolean;
    errors: string[];
    position?: Position;
  }> {
    const errors: string[] = [];

    if (!payload.trader || !payload.trader.startsWith('0x')) {
      errors.push('Invalid trader address');
    }

    if (payload.assetId < 0 || payload.assetId > 4) {
      errors.push('Invalid asset ID (must be 0-4)');
    }

    if (payload.closePercent <= 0 || payload.closePercent > 100) {
      errors.push('Invalid close percent (must be 1-100)');
    }

    const position = database.getPosition(payload.trader, payload.assetId);
    if (!position) {
      errors.push('Position not found');
      return { isValid: false, errors };
    }

    if (position.size === 0n) {
      errors.push('Position has zero size');
    }

    const requestAge = Date.now() - payload.timestamp;
    if (requestAge > 120000) {
      errors.push(`Close request too old: ${Math.floor(requestAge/1000)}s > 120s`);
    }

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
  // BATCH PROCESSING WITH CONTRACT INTEGRATION (UNCHANGED)
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
      const contractDeltas = this.calculateContractDeltas(closes);
      const txHash = await this.submitCloseBatchToContract(contractDeltas);
      
      console.log(`💰 Contract released funds to executor via transaction: ${txHash}`);
      
      const totalPnL = closes.reduce((sum, close) => sum + close.pnl.unrealizedPnL, 0n);
      const totalFees = closes.reduce((sum, close) => sum + close.pnl.closingFees, 0n);
      const totalPayout = closes.reduce((sum, close) => sum + close.pnl.netPayout, 0n);
      const affectedAssets = [...new Set(closes.map(c => c.assetId))];

      const oldRoot = merkleTree.getCurrentRootHex();
      const newRoot = merkleTree.getCurrentRootHex();

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
      
      this.pendingCloses.unshift(...closes);
      
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
      data.netQtyDelta += close.position.closeSize;
      
      // 🔧 NEGATIVE margin delta (releasing funds) - use actual margin released
      data.netMarginDelta -= close.margin.marginToRelease;
    }

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
      marginDeltas.push(data.netMarginDelta);
      oldRoots.push(contractRoot);
      newRoots.push(newRoot);
      
      console.log(`📋 Asset ${assetId}:`);
      console.log(`   Contract root: ${contractRoot.substring(0, 10)}...`);
      console.log(`   New root: ${newRoot.substring(0, 10)}...`);
      console.log(`   Releasing: ${this.formatUSDC(-data.netMarginDelta)} to executor`);
    }

    const txHash = await contractManager.processBatch(
      assetIds,
      oldRoots,
      newRoots,
      netDeltas,
      marginDeltas
    );
    
    console.log(`✅ Contract will release funds to executor: ${txHash}`);
    return txHash;
  }

  // ====================================================================
  // UTILITIES
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
      // 🔧 Add empty margin data for failed closes
      margin: {
        originalMargin: 0n,
        marginToRelease: 0n,
        remainingMargin: 0n
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

  private formatPosition(position: Position): string {
    const side = position.size > 0n ? 'LONG' : 'SHORT';
    const size = position.size > 0n ? position.size : -position.size;
    return `${side} $${(Number(size) / 1e6).toFixed(2)}`;
  }

  // ====================================================================
  // PUBLIC QUERIES
  // ====================================================================

  getPendingCloses(): ProcessedClose[] {
    return [...this.pendingCloses];
  }

  async forceCloseBatchProcessing(): Promise<CloseBatchResult | null> {
    console.log('🚀 Force processing close batch...');
    return await this.processCloseBatch();
  }

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

export const closeExecutor = new CloseTradeExecutor();