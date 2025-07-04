import { ethers, Contract } from 'ethers';
import { PERP_ENGINE_ABI, PERP_ENGINE_ZK_ABI, CHAINLINK_MANAGER_ABI, LIQUIDITY_POOL_ABI, ERC20_ABI } from './abis';

// Setup provider and contract instances
const provider = new ethers.JsonRpcProvider(process.env.RPC_URL || 'http://localhost:8545');
const privateKey = process.env.EXECUTOR_PRIVATE_KEY || '0x' + '1'.repeat(64);
const signer = new ethers.Wallet(privateKey, provider);

// Main PerpEngine contract
export const perpZK = new Contract(
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

// Helper functions for contract interaction
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
    const rate = await perpZK.getFundingRate(assetId);
    return BigInt(rate.toString());
  } catch (error) {
    console.warn('Failed to fetch funding rate, using fallback');
    return 100n * 10n ** 15n; // 0.1% fallback
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

export async function getPoolUtilization(): Promise<bigint> {
  try {
    const utilization = await perpZK.getPoolUtilization();
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

// Position management helper functions
export async function getPosition(trader: string, assetId: number): Promise<{
  sizeUsd: bigint;
  collateral: bigint;
  entryPrice: bigint;
  entryFundingRate: bigint;
  isLong: boolean;
  lastBorrowingUpdate: bigint;
} | null> {
  try {
    const position = await perpZK.getPosition(trader, assetId);
    
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
    const pnl = await perpZK.getPnL(assetId, trader);
    return BigInt(pnl.toString());
  } catch (error) {
    console.error(`Failed to fetch PnL for ${trader}, asset ${assetId}:`, error);
    return 0n;
  }
}

export async function getCollateralRatio(trader: string, assetId: number): Promise<bigint> {
  try {
    const ratio = await perpZK.getCollateralRatio(trader, assetId);
    return BigInt(ratio.toString());
  } catch (error) {
    console.error(`Failed to fetch collateral ratio for ${trader}, asset ${assetId}:`, error);
    return 0n;
  }
}

export async function getLeverage(trader: string, assetId: number): Promise<bigint> {
  try {
    const leverage = await perpZK.getLeverage(trader, assetId);
    return BigInt(leverage.toString());
  } catch (error) {
    console.error(`Failed to fetch leverage for ${trader}, asset ${assetId}:`, error);
    return 0n;
  }
}

export async function getLiquidationPrice(trader: string, assetId: number): Promise<bigint> {
  try {
    const price = await perpZK.getLiquidationPrice(trader, assetId);
    return BigInt(price.toString());
  } catch (error) {
    console.error(`Failed to fetch liquidation price for ${trader}, asset ${assetId}:`, error);
    return 0n;
  }
}

// Market data helper functions
export async function getOpenInterest(assetId: number): Promise<{ longUsd: bigint; shortUsd: bigint }> {
  try {
    const [longUsd, shortUsd] = await perpZK.getOpenInterest(assetId);
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
    const longTokens = await perpZK.getLongOI(assetId);
    return BigInt(longTokens.toString());
  } catch (error) {
    console.error(`Failed to fetch long OI tokens for asset ${assetId}:`, error);
    return 0n;
  }
}

// Configuration helper functions
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
      perpZK.fundingRateSensitivity(),
      perpZK.minCollateralRatioBps(),
      perpZK.maxUtilizationBps(),
      perpZK.openFeeBps(),
      perpZK.closeFeeBps(),
      perpZK.liquidationFeeBps(),
      perpZK.borrowingRateAnnualBps(),
      perpZK.isPaused()
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

// Token management functions
export async function approveToken(spender: string, amount: bigint): Promise<void> {
  try {
    const tx = await usdcToken.approve(spender, amount);
    await tx.wait();
    console.log(`💰 Approved ${amount} USDC for ${spender}`);
  } catch (error) {
    console.error('Failed to approve token:', error);
    throw error;
  }
}

export async function transferToken(to: string, amount: bigint): Promise<void> {
  try {
    const tx = await usdcToken.transfer(to, amount);
    await tx.wait();
    console.log(`💰 Transferred ${amount} USDC to ${to}`);
  } catch (error) {
    console.error('Failed to transfer token:', error);
    throw error;
  }
}

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

// Liquidation functions
export async function isPositionLiquidatable(trader: string, assetId: number): Promise<boolean> {
  try {
    return await perpZK.isLiquidatable(trader, assetId);
  } catch (error) {
    console.error(`Failed to check liquidation status for ${trader}, asset ${assetId}:`, error);
    return false;
  }
}

export async function liquidatePosition(trader: string, assetId: number): Promise<string> {
  try {
    const tx = await perpZK.liquidate(trader, assetId, { gasLimit: 600_000 });
    const receipt = await tx.wait();
    console.log(`🔥 Liquidated ${trader} asset ${assetId}, gas used: ${receipt.gasUsed}`);
    return tx.hash;
  } catch (error) {
    console.error(`Failed to liquidate ${trader}, asset ${assetId}:`, error);
    throw error;
  }
}

// Vault hedge functions (for vault integration)
export async function openVaultHedge(assetId: number, hedgeAmount: bigint): Promise<string> {
  try {
    const tx = await perpZK.openVaultHedge(assetId, hedgeAmount, { gasLimit: 800_000 });
    const receipt = await tx.wait();
    console.log(`🛡️ Opened vault hedge for asset ${assetId}, amount: ${hedgeAmount}`);
    return tx.hash;
  } catch (error) {
    console.error(`Failed to open vault hedge for asset ${assetId}:`, error);
    throw error;
  }
}

export async function closeVaultHedge(assetId: number, redeemAmount: bigint): Promise<{ txHash: string; actualReturn: bigint }> {
  try {
    const tx = await perpZK.closeVaultHedge(assetId, redeemAmount, { gasLimit: 800_000 });
    const receipt = await tx.wait();
    
    // Parse the return value from logs or call static function
    const actualReturn = 0n; // Would need to parse from transaction logs or use callStatic
    
    console.log(`🛡️ Closed vault hedge for asset ${assetId}, redeemed: ${redeemAmount}`);
    return { txHash: tx.hash, actualReturn };
  } catch (error) {
    console.error(`Failed to close vault hedge for asset ${assetId}:`, error);
    throw error;
  }
}

export async function getVaultHedgePosition(assetId: number): Promise<{
  sizeUsd: bigint;
  collateral: bigint;
  entryPrice: bigint;
  currentPnL: bigint;
  currentValue: bigint;
  exists: boolean;
} | null> {
  try {
    const position = await perpZK.getVaultHedgePosition(assetId);
    
    if (!position.exists) {
      return null;
    }
    
    return {
      sizeUsd: BigInt(position.sizeUsd.toString()),
      collateral: BigInt(position.collateral.toString()),
      entryPrice: BigInt(position.entryPrice.toString()),
      currentPnL: BigInt(position.currentPnL.toString()),
      currentValue: BigInt(position.currentValue.toString()),
      exists: position.exists
    };
  } catch (error) {
    console.error(`Failed to fetch vault hedge position for asset ${assetId}:`, error);
    return null;
  }
}

// Event listeners for monitoring
export function setupEventListeners(callback: (event: any) => void): void {
  // Position events
  perpZK.on('PositionOpened', (trader, asset, sizeUsd, collateralAmount, price, isLong, event) => {
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

  perpZK.on('PositionClosed', (trader, asset, sizeUsd, netReturn, pnl, event) => {
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

  perpZK.on('PositionLiquidated', (trader, asset, positionSize, penalty, event) => {
    callback({
      type: 'PositionLiquidated',
      trader,
      asset: Number(asset),
      positionSize: BigInt(positionSize.toString()),
      penalty: BigInt(penalty.toString()),
      blockNumber: event.blockNumber,
      transactionHash: event.transactionHash
    });
  });

  // Funding events
  perpZK.on('FundingUpdated', (asset, hourlyFundingRate, newCumulativeFundingRate, event) => {
    callback({
      type: 'FundingUpdated',
      asset: Number(asset),
      hourlyFundingRate: BigInt(hourlyFundingRate.toString()),
      newCumulativeFundingRate: BigInt(newCumulativeFundingRate.toString()),
      blockNumber: event.blockNumber,
      transactionHash: event.transactionHash
    });
  });

  // Vault hedge events
  perpZK.on('VaultHedgeOpened', (user, asset, amount, event) => {
    callback({
      type: 'VaultHedgeOpened',
      user,
      asset: Number(asset),
      amount: BigInt(amount.toString()),
      blockNumber: event.blockNumber,
      transactionHash: event.transactionHash
    });
  });

  perpZK.on('VaultHedgeClosed', (user, asset, amount, event) => {
    callback({
      type: 'VaultHedgeClosed',
      user,
      asset: Number(asset),
      amount: BigInt(amount.toString()),
      blockNumber: event.blockNumber,
      transactionHash: event.transactionHash
    });
  });
}

// Utility functions
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

export { provider, signer };