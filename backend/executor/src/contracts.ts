// src/contracts.ts
import { Contract, Wallet, JsonRpcProvider } from 'ethers';
import PerpEngineZKABI from './abis/PerpEngineZK.json'

const ChainlinkFeedABI = ['function latestRoundData() view returns (uint80,int256,uint256,uint256,uint80)'];

const PRICE_FEEDS: Record<number, string> = {
  0: process.env.TSLA_FEED_ADDRESS!, // TSLA/USD
  1: process.env.AAPL_FEED_ADDRESS!, // AAPL/USD
  // Add more as needed
};

// Initialize contracts
export const provider = new JsonRpcProvider(process.env.RPC_URL);
export const wallet = new Wallet(process.env.EXECUTOR_PRIVATE_KEY!, provider);
export const perpEngineZkContract = new Contract(
  process.env.PERP_ENGINE_ZK_ADDRESS!,
  PerpEngineZKABI.abi,
  wallet
);

// ChainLink Feed
export async function getPrice(assetId: number): Promise<bigint> {
  const feedAddress = PRICE_FEEDS[assetId];
  if (!feedAddress) {
    throw new Error(`No price feed for asset ${assetId}`);
  }
  
  const feed = new Contract(feedAddress, ChainlinkFeedABI, provider);
  const [, price] = await feed.latestRoundData();
  
  return BigInt(price); // Returns price in 1e8 format
}


// ========================================
// Basic Contract Functions
// ========================================

export async function getAsset(assetId: number) {
  const asset = await perpEngineZkContract.asset(assetId);
  return {
    root: asset.root,
    lpNetQty: BigInt(asset.lpNetQty),
    lpMargin: BigInt(asset.lpMargin),
    cumFunding: BigInt(asset.cumFunding),
    lastFundingTs: Number(asset.lastFundingTs)
  };
}

export async function getMerkleRoot(assetId: number): Promise<string> {
  const asset = await getAsset(assetId);
  return asset.root;
}

export async function getCumulativeFunding(assetId: number): Promise<bigint> {
  const asset = await getAsset(assetId);
  return asset.cumFunding;
}

// ========================================
// Trading Functions
// ========================================

export async function submitNetTrade(
  assetId: number,
  qty: bigint,
  marginDelta: bigint
): Promise<string> {
  console.log(`📤 Submitting net trade: asset ${assetId}, qty ${qty}, margin ${marginDelta}`);
  
  const tx = await perpEngineZkContract.tradeNet(assetId, qty, marginDelta, {
    gasLimit: 300_000
  });
  
  await tx.wait();
  console.log(`✅ Net trade confirmed: ${tx.hash}`);
  return tx.hash;
}

// ========================================
// Liquidation Functions
// ========================================

export async function submitLiquidation(
  assetId: number,
  oldRoot: string,
  newRoot: string,
  trader: string,
  size: bigint,
  margin: bigint,
  entryFunding: bigint,
  proof: string
): Promise<string> {
  console.log(`⚡ Submitting liquidation: ${trader} asset ${assetId}`);
  
  const tx = await perpEngineZkContract.verifyAndLiquidate(
    assetId,
    oldRoot,
    newRoot,
    trader,
    size,
    margin,
    entryFunding,
    proof,
    { gasLimit: 600_000 }
  );
  
  await tx.wait();
  console.log(`✅ Liquidation confirmed: ${tx.hash}`);
  return tx.hash;
}

// ========================================
// Funding Functions
// ========================================

export async function settleFunding(assetId: number, premium: bigint): Promise<string> {
  console.log(`💰 Settling funding: asset ${assetId}, premium ${premium}`);
  
  const tx = await perpEngineZkContract.settleFunding(assetId, premium, {
    gasLimit: 150_000
  });
  
  await tx.wait();
  console.log(`✅ Funding settled: ${tx.hash}`);
  return tx.hash;
}

export async function canSettleFunding(assetId: number): Promise<boolean> {
  const asset = await getAsset(assetId);
  const currentTime = Math.floor(Date.now() / 1000);
  const FUNDING_PERIOD = 3600; // 1 hour
  
  return currentTime >= asset.lastFundingTs + FUNDING_PERIOD;
}

export async function getTimeTillNextFunding(assetId: number): Promise<number> {
  const asset = await getAsset(assetId);
  const currentTime = Math.floor(Date.now() / 1000);
  const FUNDING_PERIOD = 3600;
  const nextFundingTime = asset.lastFundingTs + FUNDING_PERIOD;
  
  return Math.max(0, nextFundingTime - currentTime);
}

// ========================================
// Event Listening
// ========================================

export function listenToContractEvents() {
  console.log('👂 Listening to contract events...');
  
  perpEngineZkContract.on('NetTrade', (id, qty, marginDelta, event) => {
    console.log(`📊 NetTrade: asset ${id}, qty ${qty}, margin ${marginDelta}`);
  });
  
  perpEngineZkContract.on('Liquidate', (trader, id, size, event) => {
    console.log(`⚡ Liquidation: ${trader}, asset ${id}, size ${size}`);
  });
  
  perpEngineZkContract.on('FundingSettled', (id, premium, event) => {
    console.log(`💰 Funding: asset ${id}, premium ${premium}`);
  });
  
  perpEngineZkContract.on('RootUpdated', (id, newRoot, event) => {
    console.log(`🌳 Root updated: asset ${id}, root ${newRoot}`);
  });
}

// ========================================
// Batch Processing
// ========================================

export async function processBatch(trades: Array<{
  assetId: number;
  qty: bigint;
  marginDelta: bigint;
}>): Promise<void> {
  console.log(`🚀 Processing batch of ${trades.length} trades`);
  
  // Calculate net exposure per asset
  const netExposure: Record<number, { qty: bigint; marginDelta: bigint }> = {};
  
  for (const trade of trades) {
    if (!netExposure[trade.assetId]) {
      netExposure[trade.assetId] = { qty: 0n, marginDelta: 0n };
    }
    netExposure[trade.assetId].qty += trade.qty;
    netExposure[trade.assetId].marginDelta += trade.marginDelta;
  }
  
  // Submit net trades
  for (const [assetId, net] of Object.entries(netExposure)) {
    if (net.qty !== 0n || net.marginDelta !== 0n) {
      await submitNetTrade(Number(assetId), net.qty, net.marginDelta);
    }
  }
}