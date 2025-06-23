import { Contract, JsonRpcProvider } from 'ethers';
const provider = new JsonRpcProvider(process.env.RPC_URL);

const feeds: Record<number,string> = {
  0: '0xFeedAddressTSLA', // TSLA / USD (Chainlink Fuji)
  1: '0xFeedAddressAAPL'  // AAPL / USD
};

const abi = ['function latestRoundData() view returns (uint80,int256,uint256,uint256,uint80)'];

export async function getPrice(assetId: number): Promise<bigint> {
  const feed = new Contract(feeds[assetId], abi, provider);
  const [, price] = await feed.latestRoundData();
  return BigInt(price);          // 1e8
}
