import { TradePayload } from './executor';
import { balanceManager } from './balance-manager';
import { 
  getContractConfig, 
  getPoolUtilization, 
  getTotalLiquidity, 
  getReservedLiquidity,
  checkAssetPaused 
} from './contracts';

// ====================================================================
// SIMPLIFIED TRADE VALIDATOR WITH REAL CONTRACT INTEGRATION
// ====================================================================

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  netMarginRequired?: bigint;
  leverageAfterFees?: number;
}

export class TradeValidator {
  private cachedConfig: any = null;
  private lastConfigUpdate = 0;
  private readonly CONFIG_CACHE_TIME = 60000; // 1 minute cache

  constructor() {
    console.log('🔍 TradeValidator initialized with real contract integration');
  }

  // ====================================================================
  // MAIN VALIDATION FUNCTION
  // ====================================================================

  /**
   * Validate trade with real contract data
   */
  async validateTrade(trade: TradePayload): Promise<ValidationResult> {
    console.log(`🔍 Validating trade: ${trade.trader} ${trade.isLong ? 'LONG' : 'SHORT'} $${Number(BigInt(trade.qty))/1e6} asset ${trade.assetId}`);

    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: []
    };

    try {
      // 1. Basic structure validation
      this.validateBasicStructure(trade, result);
      if (!result.isValid) return result;

      // 2. Get real contract configuration
      const config = await this.getContractConfig();

      // 3. Asset pause check
      await this.validateAssetStatus(trade, result);
      if (!result.isValid) return result;

      // 4. Position size and leverage validation
      this.validatePositionSize(trade, result, config);
      if (!result.isValid) return result;

      // 5. User balance validation
      this.validateUserBalance(trade, result);
      if (!result.isValid) return result;

      // 6. Fee calculation and margin validation
      this.validateFeesAndMargin(trade, result, config);
      if (!result.isValid) return result;

      // 7. Pool utilization validation
      await this.validatePoolUtilization(trade, result, config);
      if (!result.isValid) return result;

      // 8. Add warnings for risky trades
      this.addRiskWarnings(trade, result);

      console.log(`${result.isValid ? '✅' : '❌'} Trade validation ${result.isValid ? 'passed' : 'failed'}`);
      if (result.errors.length > 0) {
        console.log(`   Errors: ${result.errors.join(', ')}`);
      }

      return result;

    } catch (error) {
      result.isValid = false;
      result.errors.push(`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return result;
    }
  }

  // ====================================================================
  // INDIVIDUAL VALIDATION METHODS
  // ====================================================================

  /**
   * Validate basic trade structure
   */
  private validateBasicStructure(trade: TradePayload, result: ValidationResult): void {
    // Trader address
    if (!trade.trader || !trade.trader.startsWith('0x') || trade.trader.length !== 42) {
      result.errors.push('Invalid trader address format');
    }

    // Asset ID
    if (typeof trade.assetId !== 'number' || trade.assetId < 0 || trade.assetId > 4) {
      result.errors.push('Invalid asset ID: must be 0-4 (TSLA, AAPL, MSFT, GOOGL, AMZN)');
    }

    // Quantity
    const qty = BigInt(trade.qty);
    if (qty <= 0n) {
      result.errors.push('Position size must be positive');
    }

    // Margin
    const margin = BigInt(trade.margin);
    if (margin <= 0n) {
      result.errors.push('Margin must be positive');
    }

    // Direction
    if (typeof trade.isLong !== 'boolean') {
      result.errors.push('isLong must be boolean');
    }

    // Timestamp
    if (typeof trade.timestamp !== 'number' || trade.timestamp <= 0) {
      result.errors.push('Invalid timestamp');
    }

    // Trade age check (max 2 minutes for MVP)
    const tradeAge = Date.now() - trade.timestamp;
    if (tradeAge > 120000) { // 2 minutes
      result.errors.push(`Trade too old: ${Math.floor(tradeAge/1000)}s > 120s`);
    }

    if (result.errors.length > 0) {
      result.isValid = false;
    }
  }

  /**
   * Validate asset is not paused
   */
  private async validateAssetStatus(trade: TradePayload, result: ValidationResult): Promise<void> {
    try {
      const isPaused = await checkAssetPaused(trade.assetId);
      if (isPaused) {
        result.errors.push(`Asset ${trade.assetId} is currently paused`);
        result.isValid = false;
      }
    } catch (error) {
      result.warnings.push('Could not verify asset pause status');
    }
  }

  /**
   * Validate position size and leverage limits
   */
  private validatePositionSize(trade: TradePayload, result: ValidationResult, config: any): void {
    const sizeUsd = BigInt(trade.qty);
    const margin = BigInt(trade.margin);

    // Min/max position size (reasonable limits for MVP)
    const minSize = 10n * 10n ** 6n; // $10 minimum
    const maxSize = 100000n * 10n ** 6n; // $100k maximum

    if (sizeUsd < minSize) {
      result.errors.push(`Position too small: $${Number(sizeUsd)/1e6} < $${Number(minSize)/1e6}`);
    }

    if (sizeUsd > maxSize) {
      result.errors.push(`Position too large: $${Number(sizeUsd)/1e6} > $${Number(maxSize)/1e6}`);
    }

    // Leverage validation using real contract config
    const leverage = Number(sizeUsd) / Number(margin);
    
    if (leverage < 1) {
      result.errors.push(`Leverage too low: ${leverage.toFixed(2)}x < 1x`);
    }

    if (leverage > 10) {
      result.errors.push(`Leverage too high: ${leverage.toFixed(2)}x > 10x`);
    }

    if (leverage > 5) {
      result.warnings.push(`High leverage detected: ${leverage.toFixed(2)}x`);
    }

    result.leverageAfterFees = leverage;

    if (result.errors.length > 0) {
      result.isValid = false;
    }
  }

  /**
   * Validate user has sufficient balance
   */
  private validateUserBalance(trade: TradePayload, result: ValidationResult): void {
    const requiredMargin = BigInt(trade.margin);
    const userBalance = balanceManager.getBalance(trade.trader);

    if (userBalance.available < requiredMargin) {
      result.errors.push(`Insufficient balance: $${Number(userBalance.available)/1e6} < $${Number(requiredMargin)/1e6}`);
      result.isValid = false;
    }

    if (userBalance.total === 0n) {
      result.warnings.push('User has no deposit history');
    }
  }

  /**
   * Calculate fees and validate margin sufficiency
   */
  private validateFeesAndMargin(trade: TradePayload, result: ValidationResult, config: any): void {
    const sizeUsd = BigInt(trade.qty);
    const margin = BigInt(trade.margin);

    // Calculate opening fee using real contract config
    const openingFeeBps = config ? Number(config.openFeeBps) : 10; // Default 0.1%
    const openingFee = (sizeUsd * BigInt(openingFeeBps)) / 10000n;

    if (margin <= openingFee) {
      result.errors.push(`Insufficient margin to cover opening fee: $${Number(margin)/1e6} <= $${Number(openingFee)/1e6}`);
      result.isValid = false;
      return;
    }

    const netMargin = margin - openingFee;
    result.netMarginRequired = netMargin;

    // Check minimum collateral ratio using real contract config
    const minCollateralRatioBps = config ? Number(config.minCollateralRatioBps) : 1000; // Default 10%
    const minMarginRequired = (sizeUsd * BigInt(minCollateralRatioBps)) / 10000n;

    if (netMargin < minMarginRequired) {
      result.errors.push(`Net margin below minimum: $${Number(netMargin)/1e6} < $${Number(minMarginRequired)/1e6} (${minCollateralRatioBps/100}%)`);
      result.isValid = false;
    }
  }

  /**
   * Validate pool utilization limits
   */
  private async validatePoolUtilization(trade: TradePayload, result: ValidationResult, config: any): Promise<void> {
    try {
      const sizeUsd = BigInt(trade.qty);
      
      // Get real pool data
      const [currentUtilization, totalLiquidity, reservedLiquidity] = await Promise.all([
        getPoolUtilization(),
        getTotalLiquidity(),
        getReservedLiquidity()
      ]);

      if (totalLiquidity === 0n) {
        result.errors.push('Pool has no liquidity');
        result.isValid = false;
        return;
      }

      // Calculate projected utilization after this trade
      const newReserved = reservedLiquidity + sizeUsd;
      const projectedUtilization = (newReserved * 10000n) / totalLiquidity; // in bps

      // Get max utilization from contract config
      const maxUtilizationBps = config ? config.maxUtilizationBps : 8000n; // Default 80%

      if (projectedUtilization > maxUtilizationBps) {
        const currentUtilBps = (reservedLiquidity * 10000n) / totalLiquidity;
        result.errors.push(
          `Pool utilization too high: ${Number(projectedUtilization)/100}% > ${Number(maxUtilizationBps)/100}% ` +
          `(current: ${Number(currentUtilBps)/100}%)`
        );
        result.isValid = false;
      }

      // Warning if approaching limit
      if (projectedUtilization > maxUtilizationBps * 9n / 10n) {
        result.warnings.push(`Pool utilization approaching limit: ${Number(projectedUtilization)/100}%`);
      }

    } catch (error) {
      console.error('Failed to validate pool utilization:', error);
      result.warnings.push('Could not verify pool utilization');
    }
  }

  /**
   * Add risk warnings
   */
  private addRiskWarnings(trade: TradePayload, result: ValidationResult): void {
    const leverage = result.leverageAfterFees || 0;
    const sizeUsd = Number(BigInt(trade.qty)) / 1e6;

    // High leverage warning
    if (leverage > 7) {
      result.warnings.push(`Very high leverage: ${leverage.toFixed(2)}x - high liquidation risk`);
    }

    // Large position warning
    if (sizeUsd > 10000) {
      result.warnings.push(`Large position: $${sizeUsd.toLocaleString()} - consider splitting into smaller trades`);
    }

    // Market hours warning (simple check)
    const hour = new Date().getUTCHours();
    if (hour < 13 || hour > 21) { // Rough US market hours
      result.warnings.push('Trading outside typical market hours - higher volatility possible');
    }
  }

  // ====================================================================
  // CONTRACT CONFIGURATION
  // ====================================================================

  /**
   * Get contract configuration with caching
   */
  private async getContractConfig(): Promise<any> {
    const now = Date.now();
    
    // Use cached config if recent
    if (this.cachedConfig && (now - this.lastConfigUpdate) < this.CONFIG_CACHE_TIME) {
      return this.cachedConfig;
    }

    try {
      console.log('📋 Fetching contract configuration...');
      this.cachedConfig = await getContractConfig();
      this.lastConfigUpdate = now;
      
      console.log('✅ Contract config loaded:', {
        minCollateralRatio: `${Number(this.cachedConfig.minCollateralRatioBps)/100}%`,
        maxUtilization: `${Number(this.cachedConfig.maxUtilizationBps)/100}%`,
        openFee: `${Number(this.cachedConfig.openFeeBps)/100}%`
      });
      
      return this.cachedConfig;
    } catch (error) {
      console.error('❌ Failed to fetch contract config:', error);
      
      // Return fallback config
      const fallbackConfig = {
        minCollateralRatioBps: 1000n, // 10%
        maxUtilizationBps: 8000n,     // 80%
        openFeeBps: 10n,              // 0.1%
        closeFeeBps: 10n,             // 0.1%
        liquidationFeeBps: 50n,       // 0.5%
        borrowingRateAnnualBps: 1000n, // 10%
        isPaused: false
      };
      
      console.log('⚠️ Using fallback contract config');
      return fallbackConfig;
    }
  }

  // ====================================================================
  // BATCH VALIDATION
  // ====================================================================

  /**
   * Validate multiple trades efficiently
   */
  async validateBatch(trades: TradePayload[]): Promise<ValidationResult[]> {
    console.log(`🔍 Validating batch of ${trades.length} trades`);

    if (trades.length === 0) {
      return [];
    }

    if (trades.length > 100) {
      const error: ValidationResult = {
        isValid: false,
        errors: [`Batch too large: ${trades.length} > 100 trades`],
        warnings: []
      };
      return trades.map(() => error);
    }

    // Pre-load contract config once for all trades
    await this.getContractConfig();

    // Validate each trade
    const results = await Promise.all(
      trades.map(trade => this.validateTrade(trade))
    );

    // Batch-level validations
    this.validateBatchLimits(trades, results);

    const validTrades = results.filter(r => r.isValid).length;
    console.log(`📊 Batch validation: ${validTrades}/${trades.length} trades valid`);

    return results;
  }

  /**
   * Additional batch-level validations
   */
  private validateBatchLimits(trades: TradePayload[], results: ValidationResult[]): void {
    // Check for duplicate trades
    const tradeKeys = new Set<string>();
    const duplicates: number[] = [];

    trades.forEach((trade, index) => {
      const key = `${trade.trader}-${trade.assetId}-${trade.timestamp}`;
      if (tradeKeys.has(key)) {
        duplicates.push(index);
      } else {
        tradeKeys.add(key);
      }
    });

    // Mark duplicates as invalid
    for (const index of duplicates) {
      results[index].isValid = false;
      results[index].errors.push('Duplicate trade detected in batch');
    }

    // Check total batch size
    const totalBatchSize = trades.reduce((sum, trade) => sum + Number(BigInt(trade.qty)), 0);
    if (totalBatchSize > 1000000) { // $1M batch limit
      for (const result of results) {
        result.warnings.push(`Large batch size: $${totalBatchSize.toLocaleString()}`);
      }
    }
  }

  // ====================================================================
  // UTILITIES
  // ====================================================================

  /**
   * Get current validation configuration
   */
  async getValidationConfig(): Promise<{
    minPositionSize: string;
    maxPositionSize: string;
    maxLeverage: number;
    maxBatchSize: number;
    tradeTimeoutMs: number;
  }> {
    return {
      minPositionSize: '$10',
      maxPositionSize: '$100,000',
      maxLeverage: 10,
      maxBatchSize: 100,
      tradeTimeoutMs: 120000 // 2 minutes
    };
  }

  /**
   * Clear cached config (for testing)
   */
  clearCache(): void {
    this.cachedConfig = null;
    this.lastConfigUpdate = 0;
    console.log('🧹 Validator cache cleared');
  }
}

// ====================================================================
// EXPORT
// ====================================================================

export const tradeValidator = new TradeValidator();