import { getContractConfig, getCurrentFunding } from './contracts';

// ====================================================================
// SIMPLIFIED FEE CALCULATOR WITH REAL CONTRACT INTEGRATION
// ====================================================================

export interface FeeBreakdown {
  openingFee: bigint;
  totalFees: bigint;
  netMargin: bigint;    // Original margin minus fees
}

export class FeeCalculator {
  private cachedConfig: any = null;
  private lastConfigUpdate = 0;
  private readonly CONFIG_CACHE_TIME = 300000; // 5 minutes cache

  constructor() {
    console.log('💰 FeeCalculator initialized with real contract integration');
  }

  // ====================================================================
  // OPENING FEE CALCULATION (MAIN MVP FOCUS)
  // ====================================================================

  /**
   * Calculate opening fee for a new position using real contract config
   */
  async calculateOpeningFee(positionSizeUsd: bigint): Promise<bigint> {
    try {
      const config = await this.getContractConfig();
      const openFeeBps = config ? Number(config.openFeeBps) : 10; // Default 0.1%
      
      const fee = (positionSizeUsd * BigInt(openFeeBps)) / 10000n;
      
      console.log(`💰 Opening fee: $${this.formatUSDC(fee)} (${openFeeBps/100}% of $${this.formatUSDC(positionSizeUsd)})`);
      
      return fee;
    } catch (error) {
      console.error('Failed to calculate opening fee, using fallback:', error);
      // Fallback: 0.1%
      return (positionSizeUsd * 10n) / 10000n;
    }
  }

  /**
   * Calculate all fees for opening a new position
   */
  async calculateOpenPositionFees(
    positionSizeUsd: bigint,
    marginAmount: bigint
  ): Promise<FeeBreakdown> {
    const openingFee = await this.calculateOpeningFee(positionSizeUsd);
    
    const totalFees = openingFee;
    const netMargin = marginAmount - totalFees;

    if (netMargin < 0n) {
      throw new Error(`Insufficient margin to cover fees: $${this.formatUSDC(marginAmount)} < $${this.formatUSDC(totalFees)}`);
    }

    const breakdown: FeeBreakdown = {
      openingFee,
      totalFees,
      netMargin
    };

    console.log(`💰 Position fees: Opening=$${this.formatUSDC(openingFee)}, Net margin=$${this.formatUSDC(netMargin)}`);

    return breakdown;
  }

  // ====================================================================
  // SIMPLIFIED FUNDING FEE (MVP - MOCK)
  // ====================================================================

  /**
   * Calculate funding fee (simplified for MVP)
   * In production, this would be more complex with time-based calculations
   */
  async calculateFundingFee(
    positionSizeUsd: bigint,
    assetId: number,
    timeElapsedHours: number = 1
  ): Promise<bigint> {
    try {
      // Get current funding rate from contract (or use mock)
      const currentFunding = await getCurrentFunding(assetId);
      
      // Simplified calculation: funding rate per hour
      // In reality, funding is usually paid every 8 hours
      const hourlyRate = currentFunding / (8n * 10n ** 18n); // Convert to hourly
      const fundingFee = (positionSizeUsd * hourlyRate * BigInt(timeElapsedHours)) / 10n ** 18n;
      
      console.log(`💰 Funding fee: $${this.formatUSDC(fundingFee)} (${timeElapsedHours}h at ${this.formatRate(hourlyRate)} hourly)`);
      
      return fundingFee > 0n ? fundingFee : 0n; // Only positive funding for MVP
    } catch (error) {
      console.warn('Failed to calculate funding fee, using mock:', error);
      // Mock: 0.01% per hour
      const mockHourlyRate = 1n * 10n ** 15n; // 0.01%
      return (positionSizeUsd * mockHourlyRate * BigInt(timeElapsedHours)) / 10n ** 18n;
    }
  }

  /**
   * Calculate borrowing fee (simplified)
   */
  async calculateBorrowingFee(
    positionSizeUsd: bigint,
    timeElapsedHours: number = 1
  ): Promise<bigint> {
    try {
      const config = await this.getContractConfig();
      const annualRateBps = config ? Number(config.borrowingRateAnnualBps) : 1000; // Default 10%
      
      // Convert annual rate to hourly
      const hourlyRateBps = annualRateBps / (365 * 24); // Hourly rate
      const borrowingFee = (positionSizeUsd * BigInt(Math.floor(hourlyRateBps * timeElapsedHours))) / 10000n;
      
      console.log(`💰 Borrowing fee: $${this.formatUSDC(borrowingFee)} (${timeElapsedHours}h at ${annualRateBps/100}% annual)`);
      
      return borrowingFee;
    } catch (error) {
      console.warn('Failed to calculate borrowing fee, using fallback:', error);
      // Fallback: 10% annual = ~0.0011% hourly
      const hourlyRateBps = 1; // ~0.0011%
      return (positionSizeUsd * BigInt(hourlyRateBps * timeElapsedHours)) / 10000n;
    }
  }

  // ====================================================================
  // BATCH FEE CALCULATIONS
  // ====================================================================

  /**
   * Calculate total fees for a batch of trades
   */
  async calculateBatchFees(trades: Array<{
    positionSizeUsd: bigint;
    marginAmount: bigint;
  }>): Promise<{
    totalOpeningFees: bigint;
    totalNetMargin: bigint;
    feesByTrade: FeeBreakdown[];
  }> {
    console.log(`💰 Calculating fees for batch of ${trades.length} trades...`);
    
    let totalOpeningFees = 0n;
    let totalNetMargin = 0n;
    const feesByTrade: FeeBreakdown[] = [];

    for (const trade of trades) {
      const breakdown = await this.calculateOpenPositionFees(
        trade.positionSizeUsd,
        trade.marginAmount
      );
      
      totalOpeningFees += breakdown.openingFee;
      totalNetMargin += breakdown.netMargin;
      feesByTrade.push(breakdown);
    }

    console.log(`💰 Batch fees: Total opening fees=$${this.formatUSDC(totalOpeningFees)}, Net margin=$${this.formatUSDC(totalNetMargin)}`);

    return {
      totalOpeningFees,
      totalNetMargin,
      feesByTrade
    };
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
      this.cachedConfig = await getContractConfig();
      this.lastConfigUpdate = now;
      return this.cachedConfig;
    } catch (error) {
      console.error('Failed to fetch contract config for fees:', error);
      
      // Return fallback config
      return {
        openFeeBps: 10n,              // 0.1%
        closeFeeBps: 10n,             // 0.1%
        liquidationFeeBps: 50n,       // 0.5%
        borrowingRateAnnualBps: 1000n // 10%
      };
    }
  }

  // ====================================================================
  // UTILITIES
  // ====================================================================

  /**
   * Format USDC amount for display
   */
  private formatUSDC(amount: bigint): string {
    return (Number(amount) / 1e6).toFixed(2);
  }

  /**
   * Format rate for display
   */
  private formatRate(rate: bigint): string {
    return `${(Number(rate) / 1e18 * 100).toFixed(4)}%`;
  }

  /**
   * Get fee summary for display
   */
  async getFeeSummary(): Promise<{
    openingFee: string;
    borrowingRateAnnual: string;
    lastUpdated: string;
  }> {
    try {
      const config = await this.getContractConfig();
      
      return {
        openingFee: `${Number(config.openFeeBps || 10n)/100}%`,
        borrowingRateAnnual: `${Number(config.borrowingRateAnnualBps || 1000n)/100}%`,
        lastUpdated: new Date(this.lastConfigUpdate).toISOString()
      };
    } catch (error) {
      return {
        openingFee: '0.1% (fallback)',
        borrowingRateAnnual: '10% (fallback)',
        lastUpdated: 'Never'
      };
    }
  }

  /**
   * Validate minimum margin covers fees
   */
  async validateMinimumMargin(margin: bigint, positionSize: bigint): Promise<boolean> {
    try {
      const openingFee = await this.calculateOpeningFee(positionSize);
      return margin > openingFee;
    } catch (error) {
      return false;
    }
  }

  /**
   * Clear cached config (for testing)
   */
  clearCache(): void {
    this.cachedConfig = null;
    this.lastConfigUpdate = 0;
    console.log('🧹 Fee calculator cache cleared');
  }
}

// ====================================================================
// EXPORT
// ====================================================================

export const feeCalculator = new FeeCalculator();