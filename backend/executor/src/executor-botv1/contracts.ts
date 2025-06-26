import { ethers, Contract } from 'ethers';
import * as dotenv from 'dotenv';

dotenv.config();

// ====================================================================
// AVALANCHE FUJI CONTRACT INTEGRATION
// ====================================================================

// Avalanche Fuji configuration
const FUJI_RPC_URL = process.env.RPC_URL || 'https://api.avax-test.network/ext/bc/C/rpc';
const CHAIN_ID = 43113; // Avalanche Fuji

// Contract addresses (to be provided)
const PERP_ENGINE_ZK_ADDRESS = process.env.PERP_ENGINE_ZK_ADDRESS || '';
const PERP_ENGINE_ADDRESS = process.env.PERP_ENGINE_ADDRESS || '';
const CHAINLINK_MANAGER_ADDRESS = process.env.CHAINLINK_MANAGER_ADDRESS || '';

// Minimal ABIs for essential functions
const PERP_ENGINE_ZK_ABI = [
  "function processBatch(uint8[] assetIds, bytes32[] oldRoots, bytes32[] newRoots, int256[] netDeltas, int256[] marginDeltas) external",
  "function getCurrentRoot(uint8 assetId) external view returns (bytes32)",
  "function initializeAsset(uint8 assetId, bytes32 initialRoot) external",
  "event RootUpdated(uint8 indexed assetId, bytes32 oldRoot, bytes32 newRoot)",
  "event BatchProcessed(uint8[] assetIds, int256[] netDeltas, int256[] marginDeltas)"
];

const PERP_ENGINE_ABI = [
  "function getOpenInterest(uint8 asset) external view returns (uint256 longUsd, uint256 shortUsd)",
  "function getFundingRate(uint8 asset) external view returns (int256)",
  "function openFeeBps() external view returns (uint256)",
  "function closeFeeBps() external view returns (uint256)",
  "function borrowingRateAnnualBps() external view returns (uint256)",
  "function minCollateralRatioBps() external view returns (uint256)",
  "function maxUtilizationBps() external view returns (uint256)",
  "function isPaused() external view returns (bool)"
];

const CHAINLINK_MANAGER_ABI = [
  "function getPrice(uint8 asset) external view returns (uint256)",
  "function checkIfAssetIsPaused(uint8 assetType) external view returns (bool)"
];

export class ContractManager {
  private provider: ethers.JsonRpcProvider;
  private signer: ethers.Wallet;
  private perpEngineZK: Contract | null = null;
  private perpEngine: Contract | null = null;
  private chainlinkManager: Contract | null = null;

  constructor() {
    console.log('🔗 Initializing contract manager for Avalanche Fuji...');
    
    const privateKey = process.env.EXECUTOR_PRIVATE_KEY;
    if (!privateKey) {
      throw new Error('EXECUTOR_PRIVATE_KEY not set in environment');
    }

    // Initialize provider and signer
    this.provider = new ethers.JsonRpcProvider(FUJI_RPC_URL);
    this.signer = new ethers.Wallet(privateKey, this.provider);
    
    this.initializeContracts();
    
    console.log(`✅ Contract manager initialized on Fuji`);
    console.log(`🔑 Executor address: ${this.signer.address}`);
  }

  // ====================================================================
  // CONTRACT INITIALIZATION
  // ====================================================================

  private initializeContracts(): void {
    try {
      // Initialize PerpEngineZK (main contract for privacy)
      if (PERP_ENGINE_ZK_ADDRESS) {
        this.perpEngineZK = new Contract(PERP_ENGINE_ZK_ADDRESS, PERP_ENGINE_ZK_ABI, this.signer);
        console.log(`🔗 PerpEngineZK connected: ${PERP_ENGINE_ZK_ADDRESS}`);
      } else {
        console.warn('⚠️ PERP_ENGINE_ZK_ADDRESS not set');
      }

      // Initialize PerpEngine (for configuration and data)
      if (PERP_ENGINE_ADDRESS) {
        this.perpEngine = new Contract(PERP_ENGINE_ADDRESS, PERP_ENGINE_ABI, this.provider);
        console.log(`🔗 PerpEngine connected: ${PERP_ENGINE_ADDRESS}`);
      } else {
        console.warn('⚠️ PERP_ENGINE_ADDRESS not set');
      }

      // Initialize ChainLink Manager (for prices)
      if (CHAINLINK_MANAGER_ADDRESS) {
        this.chainlinkManager = new Contract(CHAINLINK_MANAGER_ADDRESS, CHAINLINK_MANAGER_ABI, this.provider);
        console.log(`🔗 ChainLinkManager connected: ${CHAINLINK_MANAGER_ADDRESS}`);
      } else {
        console.warn('⚠️ CHAINLINK_MANAGER_ADDRESS not set');
      }
    } catch (error) {
      console.error('❌ Failed to initialize contracts:', error);
    }
  }

  // ====================================================================
  // BATCH PROCESSING (MAIN FUNCTION)
  // ====================================================================

  /**
   * Submit batch to PerpEngineZK contract
   */
  async processBatch(
    assetIds: number[],
    oldRoots: string[],
    newRoots: string[],
    netDeltas: bigint[],
    marginDeltas: bigint[]
  ): Promise<string> {
    if (!this.perpEngineZK) {
      throw new Error('PerpEngineZK contract not initialized');
    }

    try {
      console.log('📤 Submitting batch to PerpEngineZK...');
      console.log(`   Assets: [${assetIds.join(', ')}]`);
      console.log(`   Net deltas: [${netDeltas.map(d => this.formatDelta(d)).join(', ')}]`);
      console.log(`   Margin deltas: [${marginDeltas.map(d => this.formatUSDC(d)).join(', ')}]`);
      console.log(`   Old roots: [${oldRoots.map(r => r.substring(0, 10) + '...').join(', ')}]`);
      console.log(`   New roots: [${newRoots.map(r => r.substring(0, 10) + '...').join(', ')}]`);

      // Check if we're in mock mode (no contract addresses set)
      if (!PERP_ENGINE_ZK_ADDRESS || PERP_ENGINE_ZK_ADDRESS === '') {
        console.log('🧪 Mock mode: No contract address set, simulating success');
        const mockTxHash = '0x' + Date.now().toString(16).padStart(64, '0');
        await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate network delay
        return mockTxHash;
      }

      // Submit transaction directly - user handles initialization
      const tx = await this.perpEngineZK.processBatch(
        assetIds,
        oldRoots,
        newRoots,
        netDeltas,
        marginDeltas,
        { 
          gasLimit: 1000000, // Fixed gas limit
          maxFeePerGas: ethers.parseUnits('30', 'gwei'), // Fuji gas price
          maxPriorityFeePerGas: ethers.parseUnits('2', 'gwei')
        }
      );

      console.log(`🚀 Transaction submitted: ${tx.hash}`);
      console.log(`⏳ Waiting for confirmation...`);

      // Wait for confirmation
      const receipt = await tx.wait();
      
      if (receipt?.status === 1) {
        console.log(`✅ Batch processed successfully!`);
        console.log(`📋 Transaction: ${tx.hash}`);
        console.log(`⛽ Gas used: ${receipt.gasUsed.toString()}`);
        console.log(`🧱 Block: ${receipt.blockNumber}`);
        
        return tx.hash;
      } else {
        throw new Error('Transaction failed');
      }

    } catch (error) {
      console.error('❌ Batch processing failed:', error);
      
      if (error instanceof Error) {
        // Provide helpful error messages for common contract revert reasons
        if (error.message.includes('not owner')) {
          throw new Error('Access denied: Not contract owner');
        } else if (error.message.includes('stale root')) {
          throw new Error('Stale root: Contract root doesn\'t match provided oldRoot');
        } else if (error.message.includes('length mismatch')) {
          throw new Error('Array length mismatch in batch parameters');
        } else if (error.message.includes('insufficient funds')) {
          throw new Error('Insufficient AVAX for gas fees');
        }
      }
      
      throw new Error(`Batch processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // ====================================================================
  // MERKLE ROOT OPERATIONS
  // ====================================================================

  /**
   * Get current merkle root for an asset
   */
  async getCurrentRoot(assetId: number): Promise<string> {
    if (!this.perpEngineZK) {
      throw new Error('PerpEngineZK contract not initialized');
    }

    try {
      const root = await this.perpEngineZK.getCurrentRoot(assetId);
      return root;
    } catch (error) {
      console.error(`Failed to fetch merkle root for asset ${assetId}:`, error);
      return '0x' + '0'.repeat(64); // Return zero root on error
    }
  }

  /**
   * Initialize asset with initial root
   */
  async initializeAsset(assetId: number, initialRoot: string): Promise<string> {
    if (!this.perpEngineZK) {
      throw new Error('PerpEngineZK contract not initialized');
    }

    try {
      console.log(`🌳 Initializing asset ${assetId} with root: ${initialRoot}`);
      
      const tx = await this.perpEngineZK.initializeAsset(assetId, initialRoot);
      const receipt = await tx.wait();
      
      if (receipt?.status === 1) {
        console.log(`✅ Asset ${assetId} initialized: ${tx.hash}`);
        return tx.hash;
      } else {
        throw new Error('Asset initialization transaction failed');
      }

    } catch (error) {
      console.error(`Failed to initialize asset ${assetId}:`, error);
      throw new Error(`Asset initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // ====================================================================
  // PRICE & MARKET DATA
  // ====================================================================

  /**
   * Get current price for an asset
   */
  async getCurrentPrice(assetId: number): Promise<bigint> {
    if (!this.chainlinkManager) {
      console.warn('ChainLinkManager not available, using fallback price');
      return this.getFallbackPrice(assetId);
    }

    try {
      const price = await this.chainlinkManager.getPrice(assetId);
      return BigInt(price.toString());
    } catch (error) {
      console.warn(`Failed to fetch price for asset ${assetId}, using fallback:`, error);
      return this.getFallbackPrice(assetId);
    }
  }

  /**
   * Check if asset is paused
   */
  async isAssetPaused(assetId: number): Promise<boolean> {
    if (!this.chainlinkManager) {
      return false; // Assume not paused if can't check
    }

    try {
      return await this.chainlinkManager.checkIfAssetIsPaused(assetId);
    } catch (error) {
      console.warn(`Failed to check pause status for asset ${assetId}:`, error);
      return false;
    }
  }

  /**
   * Get fallback prices for testing
   */
  private getFallbackPrice(assetId: number): bigint {
    const fallbackPrices = {
      0: 200n * 10n ** 18n,  // TSLA: $200
      1: 150n * 10n ** 18n,  // AAPL: $150
      2: 350n * 10n ** 18n,  // MSFT: $350
      3: 2800n * 10n ** 18n, // GOOGL: $2800
      4: 3200n * 10n ** 18n  // AMZN: $3200
    };

    return fallbackPrices[assetId as keyof typeof fallbackPrices] || 1000n * 10n ** 18n;
  }

  // ====================================================================
  // CONTRACT CONFIGURATION
  // ====================================================================

  /**
   * Get fee configuration from contract
   */
  async getFeeConfig(): Promise<{
    openFeeBps: number;
    closeFeeBps: number;
    borrowingRateAnnualBps: number;
    minCollateralRatioBps: number;
    maxUtilizationBps: number;
  }> {
    if (!this.perpEngine) {
      console.warn('PerpEngine not available, using fallback config');
      return this.getFallbackFeeConfig();
    }

    try {
      const [
        openFeeBps,
        closeFeeBps,
        borrowingRateAnnualBps,
        minCollateralRatioBps,
        maxUtilizationBps
      ] = await Promise.all([
        this.perpEngine.openFeeBps(),
        this.perpEngine.closeFeeBps(),
        this.perpEngine.borrowingRateAnnualBps(),
        this.perpEngine.minCollateralRatioBps(),
        this.perpEngine.maxUtilizationBps()
      ]);

      return {
        openFeeBps: Number(openFeeBps),
        closeFeeBps: Number(closeFeeBps),
        borrowingRateAnnualBps: Number(borrowingRateAnnualBps),
        minCollateralRatioBps: Number(minCollateralRatioBps),
        maxUtilizationBps: Number(maxUtilizationBps)
      };
    } catch (error) {
      console.warn('Failed to fetch fee config from contract, using fallback:', error);
      return this.getFallbackFeeConfig();
    }
  }

  /**
   * Get open interest for an asset
   */
  async getOpenInterest(assetId: number): Promise<{ longUsd: bigint; shortUsd: bigint }> {
    if (!this.perpEngine) {
      return { longUsd: 0n, shortUsd: 0n };
    }

    try {
      const [longUsd, shortUsd] = await this.perpEngine.getOpenInterest(assetId);
      return {
        longUsd: BigInt(longUsd.toString()),
        shortUsd: BigInt(shortUsd.toString())
      };
    } catch (error) {
      console.warn(`Failed to fetch open interest for asset ${assetId}:`, error);
      return { longUsd: 0n, shortUsd: 0n };
    }
  }

  /**
   * Get funding rate for an asset
   */
  async getFundingRate(assetId: number): Promise<bigint> {
    if (!this.perpEngine) {
      return 0n;
    }

    try {
      const rate = await this.perpEngine.getFundingRate(assetId);
      return BigInt(rate.toString());
    } catch (error) {
      console.warn(`Failed to fetch funding rate for asset ${assetId}:`, error);
      return 0n;
    }
  }

  /**
   * Fallback fee configuration
   */
  private getFallbackFeeConfig() {
    return {
      openFeeBps: 10,        // 0.1%
      closeFeeBps: 10,       // 0.1%
      borrowingRateAnnualBps: 1000, // 10%
      minCollateralRatioBps: 1000,  // 10%
      maxUtilizationBps: 8000       // 80%
    };
  }

  // ====================================================================
  // NETWORK UTILITIES
  // ====================================================================

  /**
   * Get current block number
   */
  async getCurrentBlock(): Promise<number> {
    try {
      return await this.provider.getBlockNumber();
    } catch (error) {
      console.error('Failed to get current block:', error);
      return 0;
    }
  }

  /**
   * Get executor balance (AVAX)
   */
  async getExecutorBalance(): Promise<bigint> {
    try {
      const balance = await this.provider.getBalance(this.signer.address);
      return BigInt(balance.toString());
    } catch (error) {
      console.error('Failed to get executor balance:', error);
      return 0n;
    }
  }

  /**
   * Check network connectivity
   */
  async checkConnection(): Promise<boolean> {
    try {
      const blockNumber = await this.provider.getBlockNumber();
      console.log(`🌐 Connected to Fuji - Block: ${blockNumber}`);
      return true;
    } catch (error) {
      console.error('❌ Network connection failed:', error);
      return false;
    }
  }

  // ====================================================================
  // UTILITIES
  // ====================================================================

  private formatUSDC(amount: bigint): string {
    return (Number(amount) / 1e6).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  private formatDelta(delta: bigint): string {
    const abs = delta < 0n ? -delta : delta;
    const sign = delta < 0n ? '-' : '+';
    return `${sign}$${this.formatUSDC(abs)}`;
  }

  private formatAVAX(amount: bigint): string {
    return (Number(amount) / 1e18).toFixed(4);
  }

  /**
   * Get contract addresses
   */
  getContractAddresses(): {
    perpEngineZK: string;
    perpEngine: string;
    chainlinkManager: string;
  } {
    return {
      perpEngineZK: PERP_ENGINE_ZK_ADDRESS,
      perpEngine: PERP_ENGINE_ADDRESS,
      chainlinkManager: CHAINLINK_MANAGER_ADDRESS
    };
  }

  /**
   * Get executor info
   */
  getExecutorInfo(): {
    address: string;
    chainId: number;
    rpcUrl: string;
  } {
    return {
      address: this.signer.address,
      chainId: CHAIN_ID,
      rpcUrl: FUJI_RPC_URL
    };
  }

  /**
   * Get status for health check
   */
  async getStatus(): Promise<{
    connected: boolean;
    executorAddress: string;
    executorBalance: string;
    currentBlock: number;
    contracts: {
      perpEngineZK: boolean;
      perpEngine: boolean;
      chainlinkManager: boolean;
    };
  }> {
    const connected = await this.checkConnection();
    const executorBalance = await this.getExecutorBalance();
    const currentBlock = await this.getCurrentBlock();

    return {
      connected,
      executorAddress: this.signer.address,
      executorBalance: `${this.formatAVAX(executorBalance)} AVAX`,
      currentBlock,
      contracts: {
        perpEngineZK: !!this.perpEngineZK && !!PERP_ENGINE_ZK_ADDRESS,
        perpEngine: !!this.perpEngine && !!PERP_ENGINE_ADDRESS,
        chainlinkManager: !!this.chainlinkManager && !!CHAINLINK_MANAGER_ADDRESS
      }
    };
  }
}

// Export singleton instance
export const contractManager = new ContractManager();