import { IMT } from "@zk-kit/imt";
import { poseidon2 } from "poseidon-lite";
import { database, Position } from './database';

// ====================================================================
// MINIMAL POSEIDON MERKLE TREE FOR PRIVACY
// ====================================================================

export interface MerkleProof {
  root: bigint;
  leaf: bigint;
  siblings: bigint[];
  pathIndices: number[];
  leafIndex: number;
}

export class PoseidonMerkleTree {
  private tree: IMT;
  private readonly TREE_DEPTH = 20; // Support up to 2^20 = ~1M positions
  private readonly ZERO_VALUE = BigInt(0);
  private readonly ARITY = 2; // Binary tree
  
  // Map to track position hash to leaf index
  private positionToIndex = new Map<string, number>();
  
  constructor() {
    console.log('🌳 Initializing Poseidon Merkle Tree...');
    
    // Initialize IMT with poseidon2 for binary tree hashing
    this.tree = new IMT(poseidon2, this.TREE_DEPTH, this.ZERO_VALUE, this.ARITY);
    
    // Restore state from database if exists
    this.restoreFromDatabase();
    
    console.log('✅ Poseidon Merkle Tree initialized');
    console.log(`🌳 Current root: ${this.getCurrentRootHex()}`);
  }

  // ====================================================================
  // POSITION MANAGEMENT
  // ====================================================================

  /**
   * Add or update a position in the merkle tree
   */
  updatePosition(position: Position): void {
    console.log(`🌳 Updating position: ${position.trader} asset ${position.assetId}`);
    
    const positionHash = this.hashPosition(position);
    const positionKey = `${position.trader.toLowerCase()}-${position.assetId}`;
    
    // Check if position already exists
    const existingIndex = this.positionToIndex.get(positionKey);
    
    if (existingIndex !== undefined) {
      // Update existing position
      this.tree.update(existingIndex, positionHash);
      console.log(`🔄 Updated existing position at index ${existingIndex}`);
    } else {
      // Insert new position
      this.tree.insert(positionHash);
      const newIndex = this.tree.leaves.length - 1;
      this.positionToIndex.set(positionKey, newIndex);
      console.log(`✅ Inserted new position at index ${newIndex}`);
    }
    
    // Save to database
    database.savePosition(position);
    
    console.log(`🌳 New root: ${this.getCurrentRootHex()}`);
  }

  /**
   * Remove a position from the merkle tree
   */
  removePosition(trader: string, assetId: number): boolean {
    const positionKey = `${trader.toLowerCase()}-${assetId}`;
    const index = this.positionToIndex.get(positionKey);
    
    if (index === undefined) {
      console.log(`❌ Position not found: ${positionKey}`);
      return false;
    }

    // Update to zero (effectively removing)
    this.tree.update(index, this.ZERO_VALUE);
    this.positionToIndex.delete(positionKey);
    
    console.log(`🗑️ Removed position: ${positionKey} at index ${index}`);
    console.log(`🌳 New root: ${this.getCurrentRootHex()}`);
    
    return true;
  }

  // ====================================================================
  // MERKLE TREE OPERATIONS
  // ====================================================================

  /**
   * Get current merkle root
   */
  getCurrentRoot(): bigint {
    return this.toBigInt(this.tree.root);
  }

  /**
   * Get current merkle root as hex string
   */
  getCurrentRootHex(): string {
    const root = this.getCurrentRoot();
    return `0x${root.toString(16).padStart(64, '0')}`;
  }

  /**
   * Generate merkle proof for a position
   */
  generateProof(trader: string, assetId: number): MerkleProof | null {
    const positionKey = `${trader.toLowerCase()}-${assetId}`;
    const leafIndex = this.positionToIndex.get(positionKey);
    
    if (leafIndex === undefined) {
      console.log(`❌ Position not found for proof: ${positionKey}`);
      return null;
    }

    try {
      const proof = this.tree.createProof(leafIndex);
      
      return {
        root: this.toBigInt(proof.root),
        leaf: this.toBigInt(proof.leaf),
        siblings: proof.siblings.map(s => this.toBigInt(s)),
        pathIndices: proof.pathIndices,
        leafIndex: leafIndex
      };
    } catch (error) {
      console.error(`❌ Failed to generate proof for ${positionKey}:`, error);
      return null;
    }
  }

  /**
   * Verify a merkle proof
   */
  verifyProof(proof: MerkleProof): boolean {
    try {
      const imtProof = {
        root: proof.root,
        leaf: proof.leaf,
        siblings: proof.siblings,
        pathIndices: proof.pathIndices,
        leafIndex: proof.leafIndex
      };
      
      return this.tree.verifyProof(imtProof);
    } catch (error) {
      console.error('❌ Proof verification failed:', error);
      return false;
    }
  }

  // ====================================================================
  // BATCH OPERATIONS
  // ====================================================================

  /**
   * Update multiple positions in batch
   */
  batchUpdatePositions(positions: Position[]): { oldRoot: bigint; newRoot: bigint } {
    console.log(`🌳 Batch updating ${positions.length} positions...`);
    
    const oldRoot = this.getCurrentRoot();
    
    for (const position of positions) {
      this.updatePosition(position);
    }
    
    const newRoot = this.getCurrentRoot();
    
    console.log(`🌳 Batch complete: ${oldRoot.toString()} → ${newRoot.toString()}`);
    return { oldRoot, newRoot };
  }

  /**
   * Create checkpoint for rollback
   */
  createCheckpoint(): {
    root: bigint;
    positionMap: Map<string, number>;
    timestamp: number;
  } {
    console.log('📸 Creating merkle tree checkpoint...');
    
    return {
      root: this.getCurrentRoot(),
      positionMap: new Map(this.positionToIndex),
      timestamp: Date.now()
    };
  }

  /**
   * Restore from checkpoint
   */
  restoreFromCheckpoint(checkpoint: {
    root: bigint;
    positionMap: Map<string, number>;
    timestamp: number;
  }): void {
    console.log('🔄 Restoring from checkpoint...');
    
    try {
      // Rebuild tree from database positions
      this.rebuildFromDatabase();
      
      // Restore position mapping
      this.positionToIndex = new Map(checkpoint.positionMap);
      
      console.log(`✅ Restored to checkpoint root: ${this.getCurrentRootHex()}`);
    } catch (error) {
      console.error('❌ Failed to restore from checkpoint:', error);
      throw error;
    }
  }

  // ====================================================================
  // POSITION HASHING
  // ====================================================================

  /**
   * Hash position data using Poseidon (iterative approach with poseidon2)
   */
  private hashPosition(position: Position): bigint {
    try {
      // Convert trader address properly
      const traderHex = position.trader.replace('0x', '');
      const traderBigInt = BigInt('0x' + traderHex);
      
      // Hash fields using poseidon2 iteratively to combine all 6 fields
      // First combine trader and assetId
      const hash1 = poseidon2([traderBigInt, BigInt(position.assetId)]);
      
      // Then combine with size and margin  
      const hash2 = poseidon2([hash1, position.size]);
      const hash3 = poseidon2([hash2, position.margin]);
      
      // Finally combine with entryPrice and lastUpdate
      const hash4 = poseidon2([hash3, position.entryPrice]);
      const finalHash = poseidon2([hash4, BigInt(position.lastUpdate)]);
      
      return finalHash;
      
    } catch (error) {
      console.error('❌ Error hashing position:', error);
      console.error('Position data:', JSON.stringify(position, (key, value) =>
        typeof value === 'bigint' ? value.toString() : value
      ));
      throw error;
    }
  }

  /**
   * Calculate position hash for external use
   */
  calculatePositionHash(position: Position): bigint {
    return this.hashPosition(position);
  }

  // ====================================================================
  // DATABASE INTEGRATION
  // ====================================================================

  /**
   * Rebuild tree from database positions
   */
  private rebuildFromDatabase(): void {
    console.log('🔄 Rebuilding merkle tree from database...');
    
    // Create new tree
    this.tree = new IMT(poseidon2, this.TREE_DEPTH, this.ZERO_VALUE, this.ARITY);
    this.positionToIndex.clear();
    
    // Get all positions from database
    const allPositions = database.getAllPositions();
    
    // Insert all position hashes
    for (const position of allPositions) {
      const positionHash = this.hashPosition(position);
      this.tree.insert(positionHash);
      
      const positionKey = `${position.trader.toLowerCase()}-${position.assetId}`;
      const index = this.tree.leaves.length - 1;
      this.positionToIndex.set(positionKey, index);
    }
    
    console.log(`✅ Tree rebuilt with ${allPositions.length} positions`);
  }

  /**
   * Restore state from database on startup
   */
  private restoreFromDatabase(): void {
    try {
      console.log('📥 Restoring merkle state from database...');
      
      const allPositions = database.getAllPositions();
      
      if (allPositions.length === 0) {
        console.log('📝 No positions found, starting with empty tree');
        return;
      }
      
      // Rebuild tree from stored positions
      this.rebuildFromDatabase();
      
      console.log('✅ Merkle state restored from database');
    } catch (error) {
      console.log('📝 No existing merkle state found, starting fresh');
    }
  }

  // ====================================================================
  // UTILITIES
  // ====================================================================

  /**
   * Convert tree node to bigint
   */
  private toBigInt(node: any): bigint {
    if (typeof node === 'bigint') return node;
    if (typeof node === 'string') return BigInt(node);
    if (typeof node === 'number') return BigInt(node);
    throw new Error(`Cannot convert ${typeof node} to bigint`);
  }

  /**
   * Get tree statistics
   */
  getStats(): {
    totalPositions: number;
    currentRoot: string;
    treeDepth: number;
    leafCount: number;
    positionMappings: number;
  } {
    return {
      totalPositions: database.getAllPositions().length,
      currentRoot: this.getCurrentRootHex(),
      treeDepth: this.TREE_DEPTH,
      leafCount: this.tree.leaves.length,
      positionMappings: this.positionToIndex.size
    };
  }

  /**
   * Get all current leaves
   */
  getAllLeaves(): bigint[] {
    return this.tree.leaves.map(leaf => this.toBigInt(leaf));
  }

  /**
   * Find position by hash
   */
  findPositionByHash(hash: bigint): { position: Position; index: number } | null {
    // Check if hash exists in tree
    const leaves = this.getAllLeaves();
    const index = leaves.findIndex(leaf => leaf === hash);
    
    if (index === -1) return null;
    
    // Find the position that generates this hash
    const allPositions = database.getAllPositions();
    for (const position of allPositions) {
      if (this.hashPosition(position) === hash) {
        return { position, index };
      }
    }
    
    return null;
  }

  /**
   * Verify tree integrity
   */
  verifyIntegrity(): boolean {
    try {
      const allPositions = database.getAllPositions();
      console.log(`🔍 Verifying tree integrity for ${allPositions.length} positions...`);
      
      // Create temporary tree for comparison
      const tempTree = new IMT(poseidon2, this.TREE_DEPTH, this.ZERO_VALUE, this.ARITY);
      
      for (const position of allPositions) {
        const hash = this.hashPosition(position);
        tempTree.insert(hash);
      }
      
      const currentRoot = this.getCurrentRoot();
      const tempRoot = this.toBigInt(tempTree.root);
      const matches = tempRoot === currentRoot;
      
      if (matches) {
        console.log('✅ Tree integrity check passed');
      } else {
        console.error(`❌ Tree integrity check failed: expected ${tempRoot.toString()}, got ${currentRoot.toString()}`);
      }
      
      return matches;
    } catch (error) {
      console.error('❌ Tree integrity check failed:', error);
      return false;
    }
  }

  /**
   * Clear tree (for testing)
   */
  clear(): void {
    this.tree = new IMT(poseidon2, this.TREE_DEPTH, this.ZERO_VALUE, this.ARITY);
    this.positionToIndex.clear();
    console.log('🧹 Merkle tree cleared');
  }

  /**
   * Get position index
   */
  getPositionIndex(trader: string, assetId: number): number | null {
    const positionKey = `${trader.toLowerCase()}-${assetId}`;
    return this.positionToIndex.get(positionKey) ?? null;
  }

  /**
   * Check if position exists in tree
   */
  hasPosition(trader: string, assetId: number): boolean {
    return this.getPositionIndex(trader, assetId) !== null;
  }

  /**
   * Get position count
   */
  getPositionCount(): number {
    return this.positionToIndex.size;
  }

  /**
   * Export tree state for backup
   */
  exportState(): {
    root: string;
    leaves: string[];
    positionMap: Record<string, number>;
    timestamp: number;
  } {
    return {
      root: this.getCurrentRootHex(),
      leaves: this.getAllLeaves().map(leaf => leaf.toString()),
      positionMap: Object.fromEntries(this.positionToIndex),
      timestamp: Date.now()
    };
  }

  /**
   * Import tree state from backup
   */
  importState(state: {
    root: string;
    leaves: string[];
    positionMap: Record<string, number>;
    timestamp: number;
  }): void {
    console.log('📥 Importing merkle tree state...');
    
    try {
      // Rebuild from database first to ensure consistency
      this.rebuildFromDatabase();
      
      // Restore position mapping
      this.positionToIndex = new Map(Object.entries(state.positionMap));
      
      console.log(`✅ Imported state from ${new Date(state.timestamp).toISOString()}`);
    } catch (error) {
      console.error('❌ Failed to import state:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const merkleTree = new PoseidonMerkleTree();