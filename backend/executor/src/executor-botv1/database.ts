import * as fs from 'fs';
import * as path from 'path';

// ====================================================================
// MINIMAL DATABASE FOR USER BALANCES
// ====================================================================

export interface UserBalance {
  total: bigint;
  available: bigint;
  locked: bigint;
  lastUpdate: number;
}

export interface Position {
  trader: string;
  assetId: number;
  size: bigint; // Positive = long, negative = short
  margin: bigint;
  entryPrice: bigint;
  lastUpdate: number;
}

interface DatabaseData {
  balances: Record<string, {
    total: string;
    available: string;
    locked: string;
    lastUpdate: number;
  }>;
  positions: Record<string, {
    trader: string;
    assetId: number;
    size: string;
    margin: string;
    entryPrice: string;
    lastUpdate: number;
  }>;
  config: {
    lastBackup: number;
  };
}

export class MinimalDatabase {
  private data: DatabaseData;
  private readonly backupPath: string;

  constructor(dataDir: string = './data') {
    this.backupPath = path.join(dataDir, 'executor-data.json');
    this.ensureDataDirectory(dataDir);
    this.data = this.loadFromBackup();
    console.log('💾 Minimal database initialized');
  }

  // ====================================================================
  // BALANCE MANAGEMENT
  // ====================================================================

  /**
   * Add balance to user (can be negative for deductions)
   */
  addBalance(address: string, amount: bigint): boolean {
    try {
      const current = this.getUserBalance(address);
      
      this.updateBalance(address, {
        total: current.total + amount,
        available: current.available + amount,
        locked: current.locked
      });
      
      const action = amount >= 0n ? 'Added' : 'Deducted';
      const absAmount = amount >= 0n ? amount : -amount;
      console.log(`💰 ${action} ${this.formatUSDC(absAmount)} ${amount >= 0n ? 'to' : 'from'} ${address}`);
      return true;
    } catch (error) {
      console.error('Failed to add/deduct balance:', error);
      return false;
    }
  }

  /**
   * Get user balance
   */
  getUserBalance(address: string): UserBalance {
    const key = address.toLowerCase();
    const stored = this.data.balances[key];
    
    if (!stored) {
      return {
        total: 0n,
        available: 0n,
        locked: 0n,
        lastUpdate: Date.now()
      };
    }

    return {
      total: BigInt(stored.total),
      available: BigInt(stored.available),
      locked: BigInt(stored.locked),
      lastUpdate: stored.lastUpdate
    };
  }

  /**
   * Update user balance
   */
  updateBalance(address: string, balance: Omit<UserBalance, 'lastUpdate'>): void {
    const key = address.toLowerCase();
    this.data.balances[key] = {
      total: balance.total.toString(),
      available: balance.available.toString(),
      locked: balance.locked.toString(),
      lastUpdate: Date.now()
    };
    
    this.saveToBackup();
    console.log(`💾 Updated balance: ${address}`);
  }

  /**
   * Lock balance for trading
   */
  lockBalance(address: string, amount: bigint): boolean {
    const current = this.getUserBalance(address);
    
    if (current.available < amount) {
      console.error(`❌ Insufficient balance to lock: ${this.formatUSDC(current.available)} < ${this.formatUSDC(amount)}`);
      return false;
    }

    this.updateBalance(address, {
      total: current.total,
      available: current.available - amount,
      locked: current.locked + amount
    });

    console.log(`🔒 Locked ${this.formatUSDC(amount)} for ${address}`);
    this.saveToBackup();
    return true;
  }

  /**
   * Unlock balance after trade settlement
   */
  unlockBalance(address: string, amount: bigint): boolean {
    const current = this.getUserBalance(address);
    
    if (current.locked < amount) {
      console.error(`❌ Insufficient locked balance: ${this.formatUSDC(current.locked)} < ${this.formatUSDC(amount)}`);
      return false;
    }

    this.updateBalance(address, {
      total: current.total,
      available: current.available + amount,
      locked: current.locked - amount
    });

    console.log(`🔓 Unlocked ${this.formatUSDC(amount)} for ${address}`);
    this.saveToBackup();
    return true;
  }

  /**
   * Deduct fees from balance
   */
  deductFee(address: string, amount: bigint): boolean {
    const current = this.getUserBalance(address);
    
    if (current.total < amount) {
      console.error(`❌ Insufficient balance for fee: ${this.formatUSDC(current.total)} < ${this.formatUSDC(amount)}`);
      return false;
    }

    // Deduct from available first, then locked
    let newAvailable = current.available;
    let newLocked = current.locked;

    if (current.available >= amount) {
      newAvailable -= amount;
    } else {
      const fromAvailable = current.available;
      const fromLocked = amount - fromAvailable;
      newAvailable = 0n;
      newLocked -= fromLocked;
    }

    this.updateBalance(address, {
      total: current.total - amount,
      available: newAvailable,
      locked: newLocked
    });

    console.log(`💸 Deducted ${this.formatUSDC(amount)} fee from ${address}`);
    this.saveToBackup();
    return true;
  }

  /**
   * Get all balances
   */
  getAllBalances(): Array<{ address: string; balance: UserBalance }> {
    return Object.entries(this.data.balances).map(([address, stored]) => ({
      address,
      balance: {
        total: BigInt(stored.total),
        available: BigInt(stored.available),
        locked: BigInt(stored.locked),
        lastUpdate: stored.lastUpdate
      }
    }));
  }

  // ====================================================================
  // POSITION MANAGEMENT
  // ====================================================================

  /**
   * Save position
   */
  savePosition(position: Position): void {
    const key = `${position.trader.toLowerCase()}-${position.assetId}`;
    this.data.positions[key] = {
      trader: position.trader,
      assetId: position.assetId,
      size: position.size.toString(),
      margin: position.margin.toString(),
      entryPrice: position.entryPrice.toString(),
      lastUpdate: position.lastUpdate
    };
    
    console.log(`📊 Saved position: ${key} ${this.formatPosition(position)}`);
    this.saveToBackup();
  }

  /**
   * Update position size (for partial closes)
   */
  updatePositionSize(trader: string, assetId: number, newSize: bigint): boolean {
    const position = this.getPosition(trader, assetId);
    if (!position) {
      console.error(`❌ Position not found for update: ${trader} asset ${assetId}`);
      return false;
    }
    
    if (newSize === 0n) {
      // Remove position entirely
      const key = `${trader.toLowerCase()}-${assetId}`;
      delete this.data.positions[key];
      console.log(`🗑️ Position removed: ${key}`);
    } else {
      // Update position size
      const updatedPosition: Position = {
        ...position,
        size: newSize,
        lastUpdate: Date.now()
      };
      this.savePosition(updatedPosition);
      console.log(`📏 Position size updated: ${trader} asset ${assetId} new size: ${this.formatPosition(updatedPosition)}`);
    }
    
    this.saveToBackup();
    return true;
  }

  /**
   * Get position
   */
  getPosition(trader: string, assetId: number): Position | null {
    const key = `${trader.toLowerCase()}-${assetId}`;
    const stored = this.data.positions[key];
    
    if (!stored) return null;

    return {
      trader: stored.trader,
      assetId: stored.assetId,
      size: BigInt(stored.size),
      margin: BigInt(stored.margin),
      entryPrice: BigInt(stored.entryPrice),
      lastUpdate: stored.lastUpdate
    };
  }

  /**
   * Get all positions
   */
  getAllPositions(): Position[] {
    return Object.values(this.data.positions).map(stored => ({
      trader: stored.trader,
      assetId: stored.assetId,
      size: BigInt(stored.size),
      margin: BigInt(stored.margin),
      entryPrice: BigInt(stored.entryPrice),
      lastUpdate: stored.lastUpdate
    }));
  }

  /**
   * Get trader positions
   */
  getTraderPositions(trader: string): Position[] {
    return this.getAllPositions().filter(
      pos => pos.trader.toLowerCase() === trader.toLowerCase()
    );
  }

  // ====================================================================
  // PERSISTENCE
  // ====================================================================

  private ensureDataDirectory(dataDir: string): void {
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
      console.log(`📁 Created data directory: ${dataDir}`);
    }
  }

  private loadFromBackup(): DatabaseData {
    const defaultData: DatabaseData = {
      balances: {},
      positions: {},
      config: { lastBackup: Date.now() }
    };

    if (!fs.existsSync(this.backupPath)) {
      console.log('📝 No existing data found, starting fresh');
      return defaultData;
    }

    try {
      const content = fs.readFileSync(this.backupPath, 'utf8');
      const data = JSON.parse(content);
      console.log('📥 Loaded data from backup');
      return data;
    } catch (error) {
      console.error('❌ Failed to load backup, starting fresh:', error);
      return defaultData;
    }
  }

  private saveToBackup(): void {
    try {
      this.data.config.lastBackup = Date.now();
      fs.writeFileSync(this.backupPath, JSON.stringify(this.data, null, 2));
    } catch (error) {
      console.error('❌ Failed to save backup:', error);
    }
  }

  // ====================================================================
  // UTILITIES
  // ====================================================================

  private formatUSDC(amount: bigint): string {
    return `$${(Number(amount) / 1e6).toFixed(2)}`;
  }

  private formatPosition(position: Position): string {
    const side = position.size > 0n ? 'LONG' : 'SHORT';
    const size = position.size > 0n ? position.size : -position.size;
    return `${side} $${(Number(size) / 1e6).toFixed(2)}`;
  }

  /**
   * Get database statistics
   */
  getStats(): {
    totalUsers: number;
    totalBalance: bigint;
    totalLocked: bigint;
    totalPositions: number;
    lastBackup: string;
  } {
    const balances = this.getAllBalances();
    const positions = this.getAllPositions();
    
    let totalBalance = 0n;
    let totalLocked = 0n;

    for (const { balance } of balances) {
      totalBalance += balance.total;
      totalLocked += balance.locked;
    }

    return {
      totalUsers: balances.length,
      totalBalance,
      totalLocked,
      totalPositions: positions.length,
      lastBackup: new Date(this.data.config.lastBackup).toISOString()
    };
  }

  /**
   * Clear all data (for testing)
   */
  clear(): void {
    this.data = {
      balances: {},
      positions: {},
      config: { lastBackup: Date.now() }
    };
    this.saveToBackup();
    console.log('🧹 Database cleared');
  }
}

// Export singleton instance
export const database = new MinimalDatabase();