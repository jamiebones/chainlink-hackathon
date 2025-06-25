import { ethers, Contract } from 'ethers';
import { dataStore } from './data-store';
import * as dotenv from 'dotenv';

dotenv.config();

// ====================================================================
// BALANCE MANAGER WITH REAL USDC + LOWDB
// ====================================================================

export class BalanceManager {
  private provider: ethers.JsonRpcProvider;
  private executorWallet: ethers.Wallet;
  private usdcContract: Contract;
  
  // Contract addresses
  private readonly EXECUTOR_ADDRESS: string;
  private readonly USDC_ADDRESS: string;

  constructor() {
    console.log('💰 BalanceManager initializing with real USDC + lowdb...');
    
    // Load environment variables
    this.EXECUTOR_ADDRESS = process.env.EXECUTOR_ADDRESS || '';
    this.USDC_ADDRESS = process.env.USDC_ADDRESS || '';
    const EXECUTOR_PRIVATE_KEY = process.env.EXECUTOR_PRIVATE_KEY || '';
    const RPC_URL = process.env.RPC_URL || 'http://localhost:8545';

    console.log(`🔑 Executor private key: ${process.env.EXECUTOR_ADDRESS}`);
    console.log(`🌐 RPC URL: ${RPC_URL}`);
    console.log(`🔑 USDC address: ${process.env.USDC_ADDRESS}`);
    console.log(`🔑 Executor address: ${this.EXECUTOR_ADDRESS}`);
    
    if (!this.EXECUTOR_ADDRESS || !this.USDC_ADDRESS || !EXECUTOR_PRIVATE_KEY) {
      throw new Error('Missing required environment variables: EXECUTOR_ADDRESS, USDC_ADDRESS, EXECUTOR_PRIVATE_KEY');
    }
    
    // Initialize provider and wallet
    this.provider = new ethers.JsonRpcProvider(RPC_URL);
    this.executorWallet = new ethers.Wallet(EXECUTOR_PRIVATE_KEY, this.provider);
    
    // Initialize USDC contract
    const USDC_ABI = [
      "function transfer(address to, uint256 amount) external returns (bool)",
      "function transferFrom(address from, address to, uint256 amount) external returns (bool)",
      "function balanceOf(address account) external view returns (uint256)",
      "function allowance(address owner, address spender) external view returns (uint256)"
    ];
    
    this.usdcContract = new Contract(this.USDC_ADDRESS, USDC_ABI, this.executorWallet);
    
    console.log(`✅ BalanceManager initialized`);
    console.log(`💼 Executor: ${this.EXECUTOR_ADDRESS}`);
    console.log(`💵 USDC: ${this.USDC_ADDRESS}`);
  }

  // ====================================================================
  // CORE OPERATIONS WITH REAL USDC
  // ====================================================================

  /**
   * Process user deposit - transfers USDC from user to executor
   */
  async deposit(user: string, amount: bigint): Promise<string> {
    console.log(`💰 Processing deposit: ${user} → ${this.formatUSDC(amount)} USDC`);

    // Validate amount
    if (amount <= 0n) {
      throw new Error('Deposit amount must be positive');
    }

    // Check user's USDC balance
    const userUsdcBalance = await this.usdcContract.balanceOf(user);
    if (BigInt(userUsdcBalance.toString()) < amount) {
      throw new Error(`Insufficient USDC balance: ${this.formatUSDC(BigInt(userUsdcBalance.toString()))} < ${this.formatUSDC(amount)}`);
    }

    // Check allowance
    const allowance = await this.usdcContract.allowance(user, this.EXECUTOR_ADDRESS);
    if (BigInt(allowance.toString()) < amount) {
      throw new Error(`Insufficient allowance: ${this.formatUSDC(BigInt(allowance.toString()))} < ${this.formatUSDC(amount)}`);
    }

    // Execute USDC transfer: user → executor
    const tx = await this.usdcContract.transferFrom(user, this.EXECUTOR_ADDRESS, amount);
    await tx.wait();
    
    // Update balance in database
    const currentBalance = this.getBalance(user);
    const newBalance = {
      total: currentBalance.total + amount,
      available: currentBalance.available + amount,
      locked: currentBalance.locked
    };
    
    dataStore.saveBalance(user, newBalance);
    
    console.log(`✅ Deposit successful: ${tx.hash}`);
    return tx.hash;
  }

  /**
   * Process user withdrawal - transfers USDC from executor to user
   */
  async withdraw(user: string, amount: bigint): Promise<string> {
    console.log(`💸 Processing withdrawal: ${user} ← ${this.formatUSDC(amount)} USDC`);

    // Validate amount
    if (amount <= 0n) {
      throw new Error('Withdrawal amount must be positive');
    }

    // Check internal balance
    const currentBalance = this.getBalance(user);
    if (currentBalance.available < amount) {
      throw new Error(`Insufficient available balance: ${this.formatUSDC(currentBalance.available)} < ${this.formatUSDC(amount)}`);
    }

    // Check executor's USDC balance
    const executorUsdcBalance = await this.usdcContract.balanceOf(this.EXECUTOR_ADDRESS);
    if (BigInt(executorUsdcBalance.toString()) < amount) {
      throw new Error(`Executor insufficient USDC: ${this.formatUSDC(BigInt(executorUsdcBalance.toString()))}`);
    }

    // Execute USDC transfer: executor → user
    const tx = await this.usdcContract.transfer(user, amount);
    await tx.wait();
    
    // Update balance in database
    const newBalance = {
      total: currentBalance.total - amount,
      available: currentBalance.available - amount,
      locked: currentBalance.locked
    };
    
    dataStore.saveBalance(user, newBalance);
    
    console.log(`✅ Withdrawal successful: ${tx.hash}`);
    return tx.hash;
  }

  /**
   * Lock balance for trading
   */
  lockBalance(user: string, amount: bigint): void {
    const currentBalance = this.getBalance(user);
    
    if (currentBalance.available < amount) {
      throw new Error(`Insufficient available balance to lock: ${this.formatUSDC(currentBalance.available)} < ${this.formatUSDC(amount)}`);
    }
    
    const newBalance = {
      total: currentBalance.total,
      available: currentBalance.available - amount,
      locked: currentBalance.locked + amount
    };
    
    dataStore.saveBalance(user, newBalance);
    console.log(`🔒 Locked ${this.formatUSDC(amount)} for ${user}`);
  }

  /**
   * Unlock balance after trade settlement
   */
  unlockBalance(user: string, amount: bigint): void {
    const currentBalance = this.getBalance(user);
    
    if (currentBalance.locked < amount) {
      throw new Error(`Insufficient locked balance to unlock: ${this.formatUSDC(currentBalance.locked)} < ${this.formatUSDC(amount)}`);
    }
    
    const newBalance = {
      total: currentBalance.total,
      available: currentBalance.available + amount,
      locked: currentBalance.locked - amount
    };
    
    dataStore.saveBalance(user, newBalance);
    console.log(`🔓 Unlocked ${this.formatUSDC(amount)} for ${user}`);
  }

  /**
   * Deduct fees from user balance
   */
  deductFee(user: string, amount: bigint): void {
    const currentBalance = this.getBalance(user);
    
    if (currentBalance.total < amount) {
      throw new Error(`Insufficient balance for fee: ${this.formatUSDC(currentBalance.total)} < ${this.formatUSDC(amount)}`);
    }
    
    let newAvailable = currentBalance.available;
    let newLocked = currentBalance.locked;
    
    // Deduct from available first, then locked
    if (currentBalance.available >= amount) {
      newAvailable -= amount;
    } else {
      const fromAvailable = currentBalance.available;
      const fromLocked = amount - fromAvailable;
      newAvailable = 0n;
      newLocked -= fromLocked;
    }
    
    const newBalance = {
      total: currentBalance.total - amount,
      available: newAvailable,
      locked: newLocked
    };
    
    dataStore.saveBalance(user, newBalance);
    console.log(`💸 Deducted ${this.formatUSDC(amount)} fee from ${user}`);
  }

  // ====================================================================
  // EXECUTOR TRANSFERS (for pool/fees)
  // ====================================================================

  /**
   * Transfer USDC from executor to pool
   */
  async transferToPool(amount: bigint, poolAddress: string): Promise<string> {
    console.log(`🏦 Transferring ${this.formatUSDC(amount)} to pool: ${poolAddress}`);
    
    const tx = await this.usdcContract.transfer(poolAddress, amount);
    await tx.wait();
    
    console.log(`✅ Pool transfer successful: ${tx.hash}`);
    return tx.hash;
  }

  /**
   * Transfer fees to fee receiver
   */
  async transferFees(amount: bigint, feeReceiverAddress: string): Promise<string> {
    console.log(`💰 Transferring ${this.formatUSDC(amount)} fees to: ${feeReceiverAddress}`);
    
    const tx = await this.usdcContract.transfer(feeReceiverAddress, amount);
    await tx.wait();
    
    console.log(`✅ Fee transfer successful: ${tx.hash}`);
    return tx.hash;
  }

  // ====================================================================
  // QUERIES
  // ====================================================================

  /**
   * Get user balance from database
   */
  getBalance(user: string): { total: bigint; available: bigint; locked: bigint; lastUpdate: number } {
    return dataStore.getBalance(user);
  }

  /**
   * Check if user has sufficient balance
   */
  hasSufficientBalance(user: string, amount: bigint): boolean {
    const balance = this.getBalance(user);
    return balance.available >= amount;
  }

  /**
   * Get all user balances
   */
  getAllBalances(): Array<{ trader: string; balance: { total: bigint; available: bigint; locked: bigint } }> {
    return dataStore.getAllBalances();
  }

  /**
   * Get executor's on-chain USDC balance
   */
  async getExecutorUSDCBalance(): Promise<bigint> {
    try {
      const balance = await this.usdcContract.balanceOf(this.EXECUTOR_ADDRESS);
      return BigInt(balance.toString());
    } catch (error) {
      console.error('Failed to fetch executor USDC balance:', error);
      return 0n;
    }
  }

  /**
   * Get user's on-chain USDC balance
   */
  async getUserUSDCBalance(user: string): Promise<bigint> {
    try {
      const balance = await this.usdcContract.balanceOf(user);
      return BigInt(balance.toString());
    } catch (error) {
      console.error(`Failed to fetch USDC balance for ${user}:`, error);
      return 0n;
    }
  }

  /**
   * Get user's USDC allowance to executor
   */
  async getUserUSDCAllowance(user: string): Promise<bigint> {
    try {
      const allowance = await this.usdcContract.allowance(user, this.EXECUTOR_ADDRESS);
      return BigInt(allowance.toString());
    } catch (error) {
      console.error(`Failed to fetch allowance for ${user}:`, error);
      return 0n;
    }
  }

  // ====================================================================
  // BATCH OPERATIONS
  // ====================================================================

  /**
   * Validate multiple users have sufficient balance
   */
  validateBatchBalances(requirements: Array<{user: string, amount: bigint}>): boolean {
    for (const req of requirements) {
      if (!this.hasSufficientBalance(req.user, req.amount)) {
        console.error(`❌ Insufficient balance for ${req.user}: needs ${this.formatUSDC(req.amount)}`);
        return false;
      }
    }
    return true;
  }

  /**
   * Lock multiple balances atomically
   */
  batchLockBalances(locks: Array<{user: string, amount: bigint}>): boolean {
    // Validate all locks are possible first
    for (const lock of locks) {
      if (!this.hasSufficientBalance(lock.user, lock.amount)) {
        console.error(`❌ Cannot lock balance for ${lock.user}: insufficient funds`);
        return false;
      }
    }

    // Apply all locks
    for (const lock of locks) {
      this.lockBalance(lock.user, lock.amount);
    }

    console.log(`✅ Batch locked ${locks.length} balances`);
    return true;
  }

  // ====================================================================
  // UTILITIES
  // ====================================================================

  private formatUSDC(amount: bigint): string {
    return `${(Number(amount) / 1e6).toFixed(2)}`;
  }

  /**
   * Get balance statistics
   */
  getStats(): {
    totalUsers: number;
    totalDeposited: bigint;
    totalAvailable: bigint;
    totalLocked: bigint;
  } {
    const allBalances = this.getAllBalances();
    
    let totalDeposited = 0n;
    let totalAvailable = 0n;
    let totalLocked = 0n;

    for (const { balance } of allBalances) {
      totalDeposited += balance.total;
      totalAvailable += balance.available;
      totalLocked += balance.locked;
    }

    return {
      totalUsers: allBalances.length,
      totalDeposited,
      totalAvailable,
      totalLocked
    };
  }

  /**
   * Clear all balances (for testing)
   */
  clear(): void {
    // Note: This only clears the database, not actual USDC balances
    console.log('🧹 Clearing balance database (USDC remains on-chain)');
  }
}

// ====================================================================
// EXPORT
// ====================================================================

export const balanceManager = new BalanceManager();