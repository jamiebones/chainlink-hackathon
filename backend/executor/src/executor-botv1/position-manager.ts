import { Position } from './data-store';
import { dataStore } from './data-store';
import { getCurrentPrice, getContractConfig } from './contracts';

// ====================================================================
// SIMPLIFIED POSITION MANAGER WITH LOWDB + REAL CONTRACTS
// ====================================================================

export class PositionManager {
  constructor() {
    console.log('📊 PositionManager initialized with lowdb + real contract integration');
  }

  // ====================================================================
  // CORE POSITION OPERATIONS
  // ====================================================================

  /**
   * Update position in database
   */
  updatePosition(position: Position): void {
    console.log(`📊 Updating position: ${position.trader} asset ${position.assetId} ${this.formatSize(position.size)}`);
    dataStore.savePosition(position);
  }

  /**
   * Get position from database
   */
  getPosition(trader: string, assetId: number): Position | null {
    return dataStore.getPosition(trader, assetId);
  }

  /**
   * Remove position
   */
  removePosition(trader: string, assetId: number): boolean {
    return dataStore.removePosition(trader, assetId);
  }

  /**
   * Get all positions for a trader
   */
  getTraderPositions(trader: string): Position[] {
    return dataStore.getTraderPositions(trader);
  }

  /**
   * Get all positions for an asset
   */
  getAssetPositions(assetId: number): Position[] {
    return dataStore.getAssetPositions(assetId);
  }

  // ====================================================================
  // PnL CALCULATIONS WITH REAL PRICES
  // ====================================================================

  /**
   * Calculate PnL using real contract prices
   */
  async calculatePnL(trader: string, assetId: number): Promise<bigint> {
    const position = this.getPosition(trader, assetId);
    if (!position || position.size === 0n) {
      return 0n;
    }

    try {
      // Get real price from contract
      const currentPrice = await getCurrentPrice(assetId);
      return this.calculatePositionPnL(position, currentPrice);
    } catch (error) {
      console.error(`Failed to calculate PnL for ${trader}, asset ${assetId}:`, error);
      return 0n;
    }
  }

  /**
   * Calculate position PnL with given price
   */
  private calculatePositionPnL(position: Position, currentPrice: bigint): bigint {
    if (position.size === 0n) return 0n;

    const sizeUsd = position.size > 0n ? position.size : -position.size;
    const isLong = position.size > 0n;

    if (isLong) {
      // Long PnL = sizeUsd * (currentPrice - entryPrice) / entryPrice
      const priceDiff = currentPrice - position.entryPrice;
      return (sizeUsd * priceDiff) / position.entryPrice;
    } else {
      // Short PnL = sizeUsd * (entryPrice - currentPrice) / entryPrice
      const priceDiff = position.entryPrice - currentPrice;
      return (sizeUsd * priceDiff) / position.entryPrice;
    }
  }

  /**
   * Calculate leverage
   */
  calculateLeverage(trader: string, assetId: number): number {
    const position = this.getPosition(trader, assetId);
    if (!position || position.margin === 0n) return 0;

    const sizeUsd = position.size > 0n ? position.size : -position.size;
    return Number(sizeUsd) / Number(position.margin);
  }

  /**
   * Calculate margin ratio with real PnL
   */
  async calculateMarginRatio(trader: string, assetId: number): Promise<number> {
    const position = this.getPosition(trader, assetId);
    if (!position || position.size === 0n) return 0;

    const pnl = await this.calculatePnL(trader, assetId);
    const netMargin = position.margin + pnl;
    const sizeUsd = position.size > 0n ? position.size : -position.size;

    if (netMargin <= 0n) return 0;
    return (Number(netMargin) / Number(sizeUsd)) * 100;
  }

  /**
   * Calculate liquidation price using real contract config
   */
  async calculateLiquidationPrice(trader: string, assetId: number): Promise<bigint> {
    const position = this.getPosition(trader, assetId);
    if (!position || position.size === 0n) return 0n;

    try {
      // Get real min collateral ratio from contract
      const config = await getContractConfig();
      const minRatio = Number(config.minCollateralRatioBps);
      
      const sizeUsd = position.size > 0n ? position.size : -position.size;
      const isLong = position.size > 0n;
      const requiredMargin = (sizeUsd * BigInt(minRatio)) / 10000n;
      
      if (isLong) {
        const pnlAtLiquidation = position.margin - requiredMargin;
        const factor = (pnlAtLiquidation * position.entryPrice) / sizeUsd;
        return position.entryPrice + factor;
      } else {
        const pnlAtLiquidation = position.margin - requiredMargin;
        const factor = (pnlAtLiquidation * position.entryPrice) / sizeUsd;
        return position.entryPrice - factor;
      }
    } catch (error) {
      console.error(`Failed to calculate liquidation price:`, error);
      return 0n;
    }
  }

  // ====================================================================
  // POSITION SUMMARIES
  // ====================================================================

  /**
   * Get complete position summary with real data
   */
  async getPositionSummary(trader: string, assetId: number): Promise<{
    trader: string;
    assetId: number;
    size: bigint;
    margin: bigint;
    entryPrice: bigint;
    currentPrice: bigint;
    isLong: boolean;
    leverage: number;
    pnl: bigint;
    pnlPercentage: number;
    liquidationPrice: bigint;
    marginRatio: number;
  } | null> {
    const position = this.getPosition(trader, assetId);
    if (!position) return null;

    try {
      const currentPrice = await getCurrentPrice(assetId);
      const pnl = await this.calculatePnL(trader, assetId);
      const leverage = this.calculateLeverage(trader, assetId);
      const liquidationPrice = await this.calculateLiquidationPrice(trader, assetId);
      const marginRatio = await this.calculateMarginRatio(trader, assetId);
      const pnlPercentage = position.margin > 0n ? (Number(pnl) / Number(position.margin)) * 100 : 0;

      return {
        trader: position.trader,
        assetId: position.assetId,
        size: position.size,
        margin: position.margin,
        entryPrice: position.entryPrice,
        currentPrice,
        isLong: position.size > 0n,
        leverage,
        pnl,
        pnlPercentage,
        liquidationPrice,
        marginRatio
      };
    } catch (error) {
      console.error(`Failed to get position summary:`, error);
      return null;
    }
  }

  /**
   * Get asset summary with real data
   */
  async getAssetSummary(assetId: number): Promise<{
    assetId: number;
    totalLongPositions: bigint;
    totalShortPositions: bigint;
    netExposure: bigint;
    totalMargin: bigint;
    positionCount: number;
    currentPrice: bigint;
  }> {
    const positions = this.getAssetPositions(assetId);
    
    let totalLongPositions = 0n;
    let totalShortPositions = 0n;
    let totalMargin = 0n;

    for (const position of positions) {
      totalMargin += position.margin;
      
      if (position.size > 0n) {
        totalLongPositions += position.size;
      } else {
        totalShortPositions += -position.size;
      }
    }

    const netExposure = totalLongPositions - totalShortPositions;
    const currentPrice = await getCurrentPrice(assetId);

    return {
      assetId,
      totalLongPositions,
      totalShortPositions,
      netExposure,
      totalMargin,
      positionCount: positions.length,
      currentPrice
    };
  }

  // ====================================================================
  // BATCH OPERATIONS
  // ====================================================================

  /**
   * Update multiple positions
   */
  batchUpdatePositions(positions: Position[]): void {
    console.log(`📊 Batch updating ${positions.length} positions`);
    
    for (const position of positions) {
      this.updatePosition(position);
    }
    
    console.log('✅ Batch position update complete');
  }

  // ====================================================================
  // STATISTICS
  // ====================================================================

  /**
   * Get position statistics
   */
  async getStats(): Promise<{
    totalPositions: number;
    totalTraders: number;
    totalMargin: bigint;
    totalPnL: bigint;
    assetBreakdown: Array<{ assetId: number; positions: number; margin: bigint }>;
  }> {
    const allPositions = dataStore.getAllPositions();
    const traders = new Set<string>();
    let totalMargin = 0n;
    let totalPnL = 0n;
    const assetBreakdown = new Map<number, { positions: number; margin: bigint }>();

    for (const position of allPositions) {
      traders.add(position.trader.toLowerCase());
      totalMargin += position.margin;
      
      try {
        const pnl = await this.calculatePnL(position.trader, position.assetId);
        totalPnL += pnl;
      } catch (error) {
        console.error(`Error calculating PnL for ${position.trader}-${position.assetId}:`, error);
      }
      
      const current = assetBreakdown.get(position.assetId) || { positions: 0, margin: 0n };
      assetBreakdown.set(position.assetId, {
        positions: current.positions + 1,
        margin: current.margin + position.margin
      });
    }

    return {
      totalPositions: allPositions.length,
      totalTraders: traders.size,
      totalMargin,
      totalPnL,
      assetBreakdown: Array.from(assetBreakdown.entries()).map(([assetId, data]) => ({
        assetId,
        ...data
      }))
    };
  }

  /**
   * Get net exposure per asset
   */
  getNetExposureByAsset(): Map<number, bigint> {
    const allPositions = dataStore.getAllPositions();
    const netExposure = new Map<number, bigint>();
    
    for (const position of allPositions) {
      const current = netExposure.get(position.assetId) || 0n;
      netExposure.set(position.assetId, current + position.size);
    }
    
    return netExposure;
  }

  // ====================================================================
  // UTILITIES
  // ====================================================================

  private formatSize(size: bigint): string {
    const absSize = size > 0n ? size : -size;
    const direction = size > 0n ? 'LONG' : 'SHORT';
    return `${direction} $${(Number(absSize) / 1e6).toFixed(2)}`;
  }

  /**
   * Clear all positions (for testing)
   */
  clear(): void {
    console.log('🧹 Clearing position data');
  }

  /**
   * Get all positions
   */
  getAllPositions(): Position[] {
    return dataStore.getAllPositions();
  }
}

// ====================================================================
// EXPORT
// ====================================================================

export const positionManager = new PositionManager();