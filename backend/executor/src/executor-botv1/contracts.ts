import { ethers, Contract } from 'ethers';
import { PERP_ENGINE_ABI, PERP_ENGINE_ZK_ABI, CHAINLINK_MANAGER_ABI, LIQUIDITY_POOL_ABI, ERC20_ABI } from './abis';

// ====================================================================
// CONTRACT SETUP & INITIALIZATION
// ====================================================================

// Setup provider and contract instances
const provider = new ethers.JsonRpcProvider(process.env.RPC_URL || 'http://localhost:8545');
const privateKey = process.env.EXECUTOR_PRIVATE_KEY || '0x' + '1'.repeat(64);
const signer = new ethers.Wallet(privateKey, provider);

// Main PerpEngine contract
export const perpEngine = new Contract(
  process.env.PERP_ENGINE_ADDRESS || '0x' + '0'.repeat(40),
  PERP_ENGINE_ABI,
  signer
);

// Privacy layer contract
export const perpEngineZK = new Contract(
  process.env.PERP_ENGINE_ZK_ADDRESS || '0x' + '0'.repeat(40),
  PERP_ENGINE_ZK_ABI,
  signer
);

// ChainLinkManager for price feeds
export const chainlinkManager = new Contract(
  process.env.CHAINLINK_MANAGER_ADDRESS || '0x' + '0'.repeat(40),
  CHAINLINK_MANAGER_ABI,
  provider
);

// Liquidity pool contract
export const liquidityPool = new Contract(
  process.env.LIQUIDITY_POOL_ADDRESS || '0x' + '0'.repeat(40),
  LIQUIDITY_POOL_ABI,
  signer
);

// USDC token contract
export const usdcToken = new Contract(
  process.env.USDC_ADDRESS || '0x' + '0'.repeat(40),
  ERC20_ABI,
  signer
);

// Asset enum matching the contract
export enum Asset {
  TSLA = 0,
  AAPL = 1,
  MSFT = 2,
  GOOGL = 3,
  AMZN = 4
}

// ====================================================================
// PRICE & MARKET DATA FUNCTIONS
// ====================================================================

export async function getCurrentPrice(assetId: number = 0): Promise<bigint> {
  try {
    const price = await chainlinkManager.getPrice(assetId);
    return BigInt(price.toString());
  } catch (error) {
    console.warn('Failed to fetch oracle price, using fallback');
    return 2000n * 10n ** 18n; // $2000 fallback
  }
}

export async function getDexPrice(assetId: number = 0): Promise<bigint> {
  try {
    const price = await chainlinkManager.getDexPrice(assetId);
    return BigInt(price.toString());
  } catch (error) {
    console.warn('Failed to fetch DEX price, using fallback');
    return 2000n * 10n ** 18n; // $2000 fallback
  }
}

export async function getCurrentFunding(assetId: number = 0): Promise<bigint> {
  try {
    const rate = await perpEngine.getFundingRate(assetId);
    return BigInt(rate.toString());
  } catch (error) {
    console.warn('Failed to fetch funding rate, using mock');
    // Mock funding rate that changes slowly over time
    const hoursSinceEpoch = Math.floor(Date.now() / (1000 * 3600));
    return BigInt(hoursSinceEpoch) * 100n * 10n ** 15n; // 0.1% per hour
  }
}

export async function checkAssetPaused(assetId: number): Promise<boolean> {
  try {
    return await chainlinkManager.checkIfAssetIsPaused(assetId);
  } catch (error) {
    console.warn('Failed to check asset pause status');
    return false;
  }
}

// ====================================================================
// LIQUIDITY POOL FUNCTIONS
// ====================================================================

export async function getPoolUtilization(): Promise<bigint> {
  try {
    const utilization = await perpEngine.getPoolUtilization();
    return BigInt(utilization.toString());
  } catch (error) {
    console.warn('Failed to fetch pool utilization');
    return 0n;
  }
}

export async function getTotalLiquidity(): Promise<bigint> {
  try {
    const liquidity = await liquidityPool.totalLiquidity();
    return BigInt(liquidity.toString());
  } catch (error) {
    console.warn('Failed to fetch total liquidity');
    return 1000000n * 10n ** 6n; // 1M USDC fallback
  }
}

export async function getReservedLiquidity(): Promise<bigint> {
  try {
    const reserved = await liquidityPool.reservedLiquidity();
    return BigInt(reserved.toString());
  } catch (error) {
    console.warn('Failed to fetch reserved liquidity');
    return 0n;
  }
}

// ====================================================================
// POSITION MANAGEMENT FUNCTIONS
// ====================================================================

export async function getPosition(trader: string, assetId: number): Promise<{
  sizeUsd: bigint;
  collateral: bigint;
  entryPrice: bigint;
  entryFundingRate: bigint;
  isLong: boolean;
  lastBorrowingUpdate: bigint;
} | null> {
  try {
    const position = await perpEngine.getPosition(trader, assetId);
    
    // Check if position exists (sizeUsd > 0)
    if (position.sizeUsd.toString() === '0') {
      return null;
    }
    
    return {
      sizeUsd: BigInt(position.sizeUsd.toString()),
      collateral: BigInt(position.collateral.toString()),
      entryPrice: BigInt(position.entryPrice.toString()),
      entryFundingRate: BigInt(position.entryFundingRate.toString()),
      isLong: position.isLong,
      lastBorrowingUpdate: BigInt(position.lastBorrowingUpdate.toString())
    };
  } catch (error) {
    console.error(`Failed to fetch position for ${trader}, asset ${assetId}:`, error);
    return null;
  }
}

export async function getPositionPnL(trader: string, assetId: number): Promise<bigint> {
  try {
    const pnl = await perpEngine.getPnL(assetId, trader);
    return BigInt(pnl.toString());
  } catch (error) {
    console.error(`Failed to fetch PnL for ${trader}, asset ${assetId}:`, error);
    return 0n;
  }
}

export async function getCollateralRatio(trader: string, assetId: number): Promise<bigint> {
  try {
    const ratio = await perpEngine.getCollateralRatio(trader, assetId);
    return BigInt(ratio.toString());
  } catch (error) {
    console.error(`Failed to fetch collateral ratio for ${trader}, asset ${assetId}:`, error);
    return 0n;
  }
}

export async function getLeverage(trader: string, assetId: number): Promise<bigint> {
  try {
    const leverage = await perpEngine.getLeverage(trader, assetId);
    return BigInt(leverage.toString());
  } catch (error) {
    console.error(`Failed to fetch leverage for ${trader}, asset ${assetId}:`, error);
    return 0n;
  }
}

export async function getLiquidationPrice(trader: string, assetId: number): Promise<bigint> {
  try {
    const price = await perpEngine.getLiquidationPrice(trader, assetId);
    return BigInt(price.toString());
  } catch (error) {
    console.error(`Failed to fetch liquidation price for ${trader}, asset ${assetId}:`, error);
    return 0n;
  }
}

// ====================================================================
// OPEN INTEREST & MARKET DATA
// ====================================================================

export async function getOpenInterest(assetId: number): Promise<{ longUsd: bigint; shortUsd: bigint }> {
  try {
    const [longUsd, shortUsd] = await perpEngine.getOpenInterest(assetId);
    return {
      longUsd: BigInt(longUsd.toString()),
      shortUsd: BigInt(shortUsd.toString())
    };
  } catch (error) {
    console.error(`Failed to fetch open interest for asset ${assetId}:`, error);
    return { longUsd: 0n, shortUsd: 0n };
  }
}

export async function getLongOpenInterestTokens(assetId: number): Promise<bigint> {
  try {
    const longTokens = await perpEngine.getLongOI(assetId);
    return BigInt(longTokens.toString());
  } catch (error) {
    console.error(`Failed to fetch long OI tokens for asset ${assetId}:`, error);
    return 0n;
  }
}

// ====================================================================
// CONTRACT CONFIGURATION
// ====================================================================

export async function getContractConfig(): Promise<{
  fundingRateSensitivity: bigint;
  minCollateralRatioBps: bigint;
  maxUtilizationBps: bigint;
  openFeeBps: bigint;
  closeFeeBps: bigint;
  liquidationFeeBps: bigint;
  borrowingRateAnnualBps: bigint;
  isPaused: boolean;
}> {
  try {
    const [
      fundingRateSensitivity,
      minCollateralRatioBps,
      maxUtilizationBps,
      openFeeBps,
      closeFeeBps,
      liquidationFeeBps,
      borrowingRateAnnualBps,
      isPaused
    ] = await Promise.all([
      perpEngine.fundingRateSensitivity(),
      perpEngine.minCollateralRatioBps(),
      perpEngine.maxUtilizationBps(),
      perpEngine.openFeeBps(),
      perpEngine.closeFeeBps(),
      perpEngine.liquidationFeeBps(),
      perpEngine.borrowingRateAnnualBps(),
      perpEngine.isPaused()
    ]);

    return {
      fundingRateSensitivity: BigInt(fundingRateSensitivity.toString()),
      minCollateralRatioBps: BigInt(minCollateralRatioBps.toString()),
      maxUtilizationBps: BigInt(maxUtilizationBps.toString()),
      openFeeBps: BigInt(openFeeBps.toString()),
      closeFeeBps: BigInt(closeFeeBps.toString()),
      liquidationFeeBps: BigInt(liquidationFeeBps.toString()),
      borrowingRateAnnualBps: BigInt(borrowingRateAnnualBps.toString()),
      isPaused
    };
  } catch (error) {
    console.error('Failed to fetch contract config:', error);
    throw error;
  }
}

// ====================================================================
// USDC TOKEN FUNCTIONS
// ====================================================================

export async function getTokenBalance(account: string): Promise<bigint> {
  try {
    const balance = await usdcToken.balanceOf(account);
    return BigInt(balance.toString());
  } catch (error) {
    console.error(`Failed to fetch token balance for ${account}:`, error);
    return 0n;
  }
}

export async function getTokenAllowance(owner: string, spender: string): Promise<bigint> {
  try {
    const allowance = await usdcToken.allowance(owner, spender);
    return BigInt(allowance.toString());
  } catch (error) {
    console.error(`Failed to fetch allowance for ${owner} -> ${spender}:`, error);
    return 0n;
  }
}

export async function transferToken(to: string, amount: bigint): Promise<string> {
  try {
    const tx = await usdcToken.transfer(to, amount);
    const receipt = await tx.wait();
    console.log(`💰 Transferred ${formatUSDC(amount)} USDC to ${to}`);
    return tx.hash;
  } catch (error) {
    console.error('Failed to transfer token:', error);
    throw error;
  }
}

export async function transferTokenFrom(from: string, to: string, amount: bigint): Promise<string> {
  try {
    const tx = await usdcToken.transferFrom(from, to, amount);
    const receipt = await tx.wait();
    console.log(`💰 Transferred ${formatUSDC(amount)} USDC from ${from} to ${to}`);
    return tx.hash;
  } catch (error) {
    console.error('Failed to transfer token:', error);
    throw error;
  }
}

// ====================================================================
// BATCH PROCESSING FOR PRIVACY LAYER
// ====================================================================

/**
 * Submit batch to PerpEngineZK contract
 * @param assetIds - Array of asset IDs
 * @param oldRoots - Array of old merkle roots
 * @param newRoots - Array of new merkle roots
 * @param netDeltas - Array of net position deltas
 * @param marginDeltas - Array of net margin deltas
 * @returns Transaction hash
 */
export async function processBatch(
  assetIds: number[],
  oldRoots: string[],
  newRoots: string[],
  netDeltas: bigint[],
  marginDeltas: bigint[]
): Promise<string> {
  try {
    console.log('📤 Submitting batch to PerpEngineZK...');
    console.log(`   Assets: [${assetIds.join(', ')}]`);
    console.log(`   Net deltas: [${netDeltas.map(d => formatDelta(d)).join(', ')}]`);
    console.log(`   Margin deltas: [${marginDeltas.map(d => formatUSDC(d)).join(', ')}]`);

    const tx = await perpEngineZK.processBatch(
      assetIds,
      oldRoots,
      newRoots,
      netDeltas,
      marginDeltas,
      { gasLimit: 3_000_000 }
    );

    const receipt = await tx.wait();
    
    console.log(`✅ Batch processed successfully: ${tx.hash}`);
    console.log(`⛽ Gas used: ${receipt.gasUsed.toString()}`);
    
    return tx.hash;

  } catch (error) {
    console.error('❌ Batch processing failed:', error);
    throw new Error(`Batch processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get current merkle root for an asset from PerpEngineZK
 * @param assetId - Asset ID
 * @returns Current merkle root
 */
export async function getCurrentMerkleRoot(assetId: number): Promise<string> {
  try {
    const root = await perpEngineZK.getCurrentRoot(assetId);
    return root;
  } catch (error) {
    console.error(`Failed to fetch merkle root for asset ${assetId}:`, error);
    return '0x' + '0'.repeat(64); // Return zero root on error
  }
}

/**
 * Initialize asset in PerpEngineZK with initial root
 * @param assetId - Asset ID to initialize
 * @param initialRoot - Initial merkle root
 * @returns Transaction hash
 */
export async function initializeAsset(assetId: number, initialRoot: string): Promise<string> {
  try {
    console.log(`🌳 Initializing asset ${assetId} with root: ${initialRoot}`);
    
    const tx = await perpEngineZK.initializeAsset(assetId, initialRoot);
    const receipt = await tx.wait();
    
    console.log(`✅ Asset ${assetId} initialized: ${tx.hash}`);
    return tx.hash;

  } catch (error) {
    console.error(`Failed to initialize asset ${assetId}:`, error);
    throw new Error(`Asset initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// ====================================================================
// LIQUIDATION FUNCTIONS
// ====================================================================

export async function isPositionLiquidatable(trader: string, assetId: number): Promise<boolean> {
  try {
    return await perpEngine.isLiquidatable(trader, assetId);
  } catch (error) {
    console.error(`Failed to check liquidation status for ${trader}, asset ${assetId}:`, error);
    return false;
  }
}

export async function liquidatePosition(trader: string, assetId: number): Promise<string> {
  try {
    const tx = await perpEngine.liquidate(trader, assetId, { gasLimit: 600_000 });
    const receipt = await tx.wait();
    console.log(`🔥 Liquidated ${trader} asset ${assetId}, gas used: ${receipt.gasUsed}`);
    return tx.hash;
  } catch (error) {
    console.error(`Failed to liquidate ${trader}, asset ${assetId}:`, error);
    throw error;
  }
}

// ====================================================================
// EVENT MONITORING
// ====================================================================

export function setupEventListeners(callback: (event: any) => void): void {
  console.log('👂 Setting up contract event listeners...');

  // Position events from PerpEngine
  perpEngine.on('PositionOpened', (trader, asset, sizeUsd, collateralAmount, price, isLong, event) => {
    callback({
      type: 'PositionOpened',
      trader,
      asset: Number(asset),
      sizeUsd: BigInt(sizeUsd.toString()),
      collateralAmount: BigInt(collateralAmount.toString()),
      price: BigInt(price.toString()),
      isLong,
      blockNumber: event.blockNumber,
      transactionHash: event.transactionHash
    });
  });

  perpEngine.on('PositionClosed', (trader, asset, sizeUsd, netReturn, pnl, event) => {
    callback({
      type: 'PositionClosed',
      trader,
      asset: Number(asset),
      sizeUsd: BigInt(sizeUsd.toString()),
      netReturn: BigInt(netReturn.toString()),
      pnl: BigInt(pnl.toString()),
      blockNumber: event.blockNumber,
      transactionHash: event.transactionHash
    });
  });

  // Batch events from PerpEngineZK
  perpEngineZK.on('BatchProcessed', (assetIds, netDeltas, marginDeltas, event) => {
    callback({
      type: 'BatchProcessed',
      assetIds: assetIds.map((id: any) => Number(id)),
      netDeltas: netDeltas.map((delta: any) => BigInt(delta.toString())),
      marginDeltas: marginDeltas.map((delta: any) => BigInt(delta.toString())),
      blockNumber: event.blockNumber,
      transactionHash: event.transactionHash
    });
  });

  perpEngineZK.on('RootUpdated', (assetId, oldRoot, newRoot, event) => {
    callback({
      type: 'RootUpdated',
      assetId: Number(assetId),
      oldRoot,
      newRoot,
      blockNumber: event.blockNumber,
      transactionHash: event.transactionHash
    });
  });

  console.log('✅ Event listeners set up successfully');
}

// ====================================================================
// UTILITY FUNCTIONS
// ====================================================================

export function formatUSDC(amount: bigint): string {
  return (Number(amount) / 1e6).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

export function formatPrice(price: bigint): string {
  return (Number(price) / 1e18).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

export function formatLeverage(leverage: bigint): string {
  return (Number(leverage) / 1e6).toFixed(2) + 'x';
}

export function formatBps(bps: bigint): string {
  return (Number(bps) / 100).toFixed(2) + '%';
}

export function formatDelta(delta: bigint): string {
  const abs = delta < 0n ? -delta : delta;
  const sign = delta < 0n ? '-' : '+';
  return `${sign}$${formatUSDC(abs)}`;
}

// Export provider and signer for advanced usage
export { provider, signer };