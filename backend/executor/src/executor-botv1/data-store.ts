import { LowSync } from 'lowdb';
import { JSONFileSync } from 'lowdb/node';
import * as fs from 'fs';
import * as path from 'path';

// ====================================================================
// INTERFACES & TYPES
// ====================================================================

export interface Position {
  trader: string;
  assetId: number;
  size: bigint;           // Signed: positive = long, negative = short
  margin: bigint;         // Collateral amount
  entryPrice: bigint;     // Entry price (18 decimals)
  entryFunding: bigint;   // Entry funding rate
  lastUpdate: number;     // Timestamp of last update
}

export interface UserBalance {
  total: string;          // Store as string to handle bigint
  available: string;      
  locked: string;         
  lastUpdate: number;
}

export interface BatchRecord {
  batchId: string;
  assetIds: number[];
  netDeltas: string[];    // Store bigint as string
  marginDeltas: string[];
  processedTrades: number;
  totalFees: string;
  timestamp: number;
  blockNumber: number;
  txHash?: string;
  success: boolean;
  error?: string;
}

export interface TradeRecord {
  tradeId: string;
  trader: string;
  assetId: number;
  qty: string;
  margin: string;
  isLong: boolean;
  timestamp: number;
  isValid: boolean;
  errors?: string[];
  processedAt?: number;
  batchId?: string;
}

export interface MerkleState {
  root: string;
  depth: number;
  nextLeafIndex: number;
  lastUpdate: number;
}

// Database schema
export interface DatabaseSchema {
  positions: Record<string, Position>;
  balances: Record<string, UserBalance>;
  batches: BatchRecord[];
  trades: TradeRecord[];
  merkleState: MerkleState;
  config: {
    lastProcessedBlock: number;
    executorAddress: string;
    initialized: boolean;
  };
}

// ====================================================================
// DATA STORE CLASS
// ====================================================================

export class DataStore {
  private db: LowSync<DatabaseSchema>;
  private dataDir: string;

  constructor(dataDir: string = './data') {
    this.dataDir = dataDir;
    this.ensureDataDirectory();
    
    const adapter = new JSONFileSync<DatabaseSchema>(path.join(dataDir, 'database.json'));
    this.db = new LowSync(adapter, this.getDefaultData());
    
    this.db.read();
    this.initialize();
    
    console.log('💾 DataStore initialized with lowdb');
  }

  // ====================================================================
  // INITIALIZATION
  // ====================================================================

  private ensureDataDirectory(): void {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
      console.log(`📁 Created data directory: ${this.dataDir}`);
    }
  }

  private getDefaultData(): DatabaseSchema {
    return {
      positions: {},
      balances: {},
      batches: [],
      trades: [],
      merkleState: {
        root: '0x' + '0'.repeat(64),
        depth: 20,
        nextLeafIndex: 0,
        lastUpdate: Date.now()
      },
      config: {
        lastProcessedBlock: 0,
        executorAddress: process.env.EXECUTOR_ADDRESS || '',
        initialized: false
      }
    };
  }

  private initialize(): void {
    if (!this.db.data) {
      this.db.data = this.getDefaultData();
      this.db.write();
    }

    // Update config if needed
    this.db.data.config.executorAddress = process.env.EXECUTOR_ADDRESS || this.db.data.config.executorAddress;
    this.db.data.config.initialized = true;
    this.db.write();
  }

  // ====================================================================
  // POSITION MANAGEMENT
  // ====================================================================

  savePosition(position: Position): void {
    const key = `${position.trader.toLowerCase()}-${position.assetId}`;
    
    // Convert bigints to strings for storage
    this.db.data.positions[key] = {
      ...position,
      size: position.size.toString(),
      margin: position.margin.toString(),
      entryPrice: position.entryPrice.toString(),
      entryFunding: position.entryFunding.toString()
    } as any;
    
    this.db.write();
    console.log(`💾 Saved position: ${key}`);
  }

  getPosition(trader: string, assetId: number): Position | null {
    const key = `${trader.toLowerCase()}-${assetId}`;
    const stored = this.db.data.positions[key];
    
    if (!stored) return null;
    
    // Convert strings back to bigints
    return {
      ...stored,
      size: BigInt(stored.size),
      margin: BigInt(stored.margin),
      entryPrice: BigInt(stored.entryPrice),
      entryFunding: BigInt(stored.entryFunding)
    };
  }

  removePosition(trader: string, assetId: number): boolean {
    const key = `${trader.toLowerCase()}-${assetId}`;
    const existed = key in this.db.data.positions;
    
    if (existed) {
      delete this.db.data.positions[key];
      this.db.write();
      console.log(`🗑️ Removed position: ${key}`);
    }
    
    return existed;
  }

  getAllPositions(): Position[] {
    return Object.values(this.db.data.positions).map(stored => ({
      ...stored,
      size: BigInt(stored.size),
      margin: BigInt(stored.margin),
      entryPrice: BigInt(stored.entryPrice),
      entryFunding: BigInt(stored.entryFunding)
    }));
  }

  getTraderPositions(trader: string): Position[] {
    return this.getAllPositions().filter(
      pos => pos.trader.toLowerCase() === trader.toLowerCase()
    );
  }

  getAssetPositions(assetId: number): Position[] {
    return this.getAllPositions().filter(pos => pos.assetId === assetId);
  }

  // ====================================================================
  // BALANCE MANAGEMENT
  // ====================================================================

  saveBalance(trader: string, balance: { total: bigint; available: bigint; locked: bigint }): void {
    this.db.data.balances[trader.toLowerCase()] = {
      total: balance.total.toString(),
      available: balance.available.toString(),
      locked: balance.locked.toString(),
      lastUpdate: Date.now()
    };
    
    this.db.write();
    console.log(`💾 Saved balance: ${trader}`);
  }

  getBalance(trader: string): { total: bigint; available: bigint; locked: bigint; lastUpdate: number } {
    const stored = this.db.data.balances[trader.toLowerCase()];
    
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

  getAllBalances(): Array<{ trader: string; balance: { total: bigint; available: bigint; locked: bigint; lastUpdate: number } }> {
    return Object.entries(this.db.data.balances).map(([trader, stored]) => ({
      trader,
      balance: {
        total: BigInt(stored.total),
        available: BigInt(stored.available),
        locked: BigInt(stored.locked),
        lastUpdate: stored.lastUpdate
      }
    }));
  }

  // ====================================================================
  // BATCH MANAGEMENT
  // ====================================================================

  saveBatch(batch: {
    batchId: string;
    assetIds: number[];
    netDeltas: bigint[];
    marginDeltas: bigint[];
    processedTrades: number;
    totalFees: bigint;
    timestamp: number;
    blockNumber: number;
    txHash?: string;
    success: boolean;
    error?: string;
  }): void {
    const batchRecord: BatchRecord = {
      ...batch,
      netDeltas: batch.netDeltas.map(d => d.toString()),
      marginDeltas: batch.marginDeltas.map(d => d.toString()),
      totalFees: batch.totalFees.toString()
    };
    
    this.db.data.batches.push(batchRecord);
    this.db.write();
    console.log(`💾 Saved batch: ${batch.batchId}`);
  }

  getBatches(limit: number = 50): Array<{
    batchId: string;
    assetIds: number[];
    netDeltas: bigint[];
    marginDeltas: bigint[];
    processedTrades: number;
    totalFees: bigint;
    timestamp: number;
    blockNumber: number;
    txHash?: string;
    success: boolean;
    error?: string;
  }> {
    return this.db.data.batches
      .slice(-limit)
      .reverse()
      .map(stored => ({
        ...stored,
        netDeltas: stored.netDeltas.map(d => BigInt(d)),
        marginDeltas: stored.marginDeltas.map(d => BigInt(d)),
        totalFees: BigInt(stored.totalFees)
      }));
  }

  getLatestBatch(): {
    batchId: string;
    assetIds: number[];
    netDeltas: bigint[];
    marginDeltas: bigint[];
    processedTrades: number;
    totalFees: bigint;
    timestamp: number;
    blockNumber: number;
    txHash?: string;
    success: boolean;
    error?: string;
  } | null {
    const batches = this.getBatches(1);
    return batches.length > 0 ? batches[0] : null;
  }

  // ====================================================================
  // TRADE MANAGEMENT
  // ====================================================================

  saveTrade(trade: {
    tradeId: string;
    trader: string;
    assetId: number;
    qty: bigint;
    margin: bigint;
    isLong: boolean;
    timestamp: number;
    isValid: boolean;
    errors?: string[];
    processedAt?: number;
    batchId?: string;
  }): void {
    const tradeRecord: TradeRecord = {
      ...trade,
      qty: trade.qty.toString(),
      margin: trade.margin.toString()
    };
    
    this.db.data.trades.push(tradeRecord);
    this.db.write();
    console.log(`💾 Saved trade: ${trade.tradeId}`);
  }

  getTrades(limit: number = 100): Array<{
    tradeId: string;
    trader: string;
    assetId: number;
    qty: bigint;
    margin: bigint;
    isLong: boolean;
    timestamp: number;
    isValid: boolean;
    errors?: string[];
    processedAt?: number;
    batchId?: string;
  }> {
    return this.db.data.trades
      .slice(-limit)
      .reverse()
      .map(stored => ({
        ...stored,
        qty: BigInt(stored.qty),
        margin: BigInt(stored.margin)
      }));
  }

  getPendingTrades(): Array<{
    tradeId: string;
    trader: string;
    assetId: number;
    qty: bigint;
    margin: bigint;
    isLong: boolean;
    timestamp: number;
    isValid: boolean;
    errors?: string[];
  }> {
    return this.db.data.trades
      .filter(trade => !trade.processedAt && trade.isValid)
      .map(stored => ({
        ...stored,
        qty: BigInt(stored.qty),
        margin: BigInt(stored.margin)
      }));
  }

  markTradesAsProcessed(tradeIds: string[], batchId: string): void {
    const now = Date.now();
    
    for (const trade of this.db.data.trades) {
      if (tradeIds.includes(trade.tradeId)) {
        trade.processedAt = now;
        trade.batchId = batchId;
      }
    }
    
    this.db.write();
    console.log(`💾 Marked ${tradeIds.length} trades as processed`);
  }

  // ====================================================================
  // MERKLE STATE MANAGEMENT
  // ====================================================================

  saveMerkleState(state: { root: bigint; nextLeafIndex: number }): void {
    this.db.data.merkleState = {
      root: state.root.toString(),
      depth: 20,
      nextLeafIndex: state.nextLeafIndex,
      lastUpdate: Date.now()
    };
    
    this.db.write();
    console.log(`💾 Saved merkle state: root=${state.root.toString().substring(0, 10)}...`);
  }

  getMerkleState(): { root: bigint; depth: number; nextLeafIndex: number; lastUpdate: number } {
    const stored = this.db.data.merkleState;
    
    return {
      root: BigInt(stored.root),
      depth: stored.depth,
      nextLeafIndex: stored.nextLeafIndex,
      lastUpdate: stored.lastUpdate
    };
  }

  // ====================================================================
  // CONFIGURATION
  // ====================================================================

  setLastProcessedBlock(blockNumber: number): void {
    this.db.data.config.lastProcessedBlock = blockNumber;
    this.db.write();
  }

  getLastProcessedBlock(): number {
    return this.db.data.config.lastProcessedBlock;
  }

  getConfig(): { lastProcessedBlock: number; executorAddress: string; initialized: boolean } {
    return { ...this.db.data.config };
  }

  // ====================================================================
  // BACKUP & RESTORE
  // ====================================================================

  createBackup(name?: string): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupName = name || `backup-${timestamp}`;
    const backupPath = path.join(this.dataDir, `${backupName}.json`);
    
    fs.writeFileSync(backupPath, JSON.stringify(this.db.data, null, 2));
    console.log(`📦 Created backup: ${backupPath}`);
    
    return backupPath;
  }

  restoreFromBackup(backupPath: string): void {
    if (!fs.existsSync(backupPath)) {
      throw new Error(`Backup file not found: ${backupPath}`);
    }
    
    const backupData = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
    this.db.data = backupData;
    this.db.write();
    
    console.log(`📥 Restored from backup: ${backupPath}`);
  }

  // ====================================================================
  // STATISTICS & CLEANUP
  // ====================================================================

  getStats(): {
    positions: number;
    balances: number;
    batches: number;
    trades: number;
    pendingTrades: number;
    dataSize: string;
  } {
    const dbPath = path.join(this.dataDir, 'database.json');
    let dataSize = '0 KB';
    
    try {
      const stats = fs.statSync(dbPath);
      dataSize = `${(stats.size / 1024).toFixed(2)} KB`;
    } catch (error) {
      // Ignore
    }
    
    return {
      positions: Object.keys(this.db.data.positions).length,
      balances: Object.keys(this.db.data.balances).length,
      batches: this.db.data.batches.length,
      trades: this.db.data.trades.length,
      pendingTrades: this.db.data.trades.filter(t => !t.processedAt && t.isValid).length,
      dataSize
    };
  }

  clear(): void {
    this.db.data = this.getDefaultData();
    this.db.write();
    console.log('🧹 Database cleared');
  }

  // ====================================================================
  // CLEANUP OLD DATA
  // ====================================================================

  cleanupOldTrades(daysToKeep: number = 30): number {
    const cutoffTime = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);
    const initialCount = this.db.data.trades.length;
    
    this.db.data.trades = this.db.data.trades.filter(
      trade => trade.timestamp > cutoffTime
    );
    
    const removed = initialCount - this.db.data.trades.length;
    
    if (removed > 0) {
      this.db.write();
      console.log(`🧹 Cleaned up ${removed} old trades`);
    }
    
    return removed;
  }

  cleanupOldBatches(daysToKeep: number = 30): number {
    const cutoffTime = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);
    const initialCount = this.db.data.batches.length;
    
    this.db.data.batches = this.db.data.batches.filter(
      batch => batch.timestamp > cutoffTime
    );
    
    const removed = initialCount - this.db.data.batches.length;
    
    if (removed > 0) {
      this.db.write();
      console.log(`🧹 Cleaned up ${removed} old batches`);
    }
    
    return removed;
  }
}

// ====================================================================
// SINGLETON EXPORT
// ====================================================================

export const dataStore = new DataStore();