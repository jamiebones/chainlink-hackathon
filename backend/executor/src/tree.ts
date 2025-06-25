
// import { poseidon } from 'circomlibjs'
// export interface Leaf { 
// size:          
// bigint;   // signed 1e18 
// margin:        
// bigint;   // USDC 1e6 
// entryFunding:  bigint;   // 1e18 
// } 
// export function hashLeaf(l: Leaf): bigint { 
// return poseidon([l.size, l.margin, l.entryFunding]); 
// } 
// export function recomputeRoot(map: Map<string, Leaf>): bigint { 
// // naïve O(n) fold: h = poseidon(h, leafHash) 
// let acc = 0n; 
// for (const v of map.values()) acc = poseidon([acc, hashLeaf(v)]); 
// return acc; 
// } 
// import { poseidon } from 'circomlibjs';
// import { IncrementalMerkleTree } from "@zk-kit/incremental-merkle-tree";

// export interface Leaf {
//   size:         bigint; // signed 1e18
//   margin:       bigint; // USDC 1e6
//   entryFunding: bigint; // 1e18
// }

// /* leaf hash */
// export function hashLeaf(l: Leaf): bigint {
//   return poseidon([l.size, l.margin, l.entryFunding]);
// }
// export const tree = new IncrementalMerkleTree(poseidon, 20, 0n, 2);

// /* deterministic key → index mapping */
// export function keyToIndex(key: string): number {
//   // keccak256(key) mod 2^20
//   const hash = BigInt(`0x${Buffer.from(key).toString('hex')}`);
//   return Number(hash & ((1n << 20n) - 1n));
// }

// export function upsert(key: string, leaf: Leaf) {
//   const idx = keyToIndex(key);
//   tree.update(idx, hashLeaf(leaf));
// }

// export function currentRoot(): bigint {
//   return tree.root;
// }



import { poseidon } from 'circomlibjs';
import { IncrementalMerkleTree } from "@zk-kit/incremental-merkle-tree";

export interface Leaf {
  size: bigint;         // signed 1e18
  margin: bigint;       // USDC 1e6
  entryFunding: bigint; // 1e18
}

export interface MerkleProof {
  leaf: bigint;
  pathElements: bigint[];
  pathIndices: number[];
  root: bigint;
}

export interface PositionState {
  trader: string;
  assetId: number;
  leaf: Leaf;
  index: number;
  lastUpdated: number;
}

// Storage strategy: Only store what's necessary
class OptimizedMerkleTreeManager {
  private tree: IncrementalMerkleTree;
  private positionStates = new Map<string, PositionState>(); // trader-assetId -> state
  private merkleRoots: bigint[] = []; // Historical roots for verification
  private readonly TREE_DEPTH = 20;
  private readonly MAX_POSITIONS = 2 ** this.TREE_DEPTH;

  constructor() {
    this.tree = new IncrementalMerkleTree(poseidon, this.TREE_DEPTH, 0n, 2);
  }

  // ====================================================================
  // STORAGE STRATEGY: What we store vs what we don't
  // ====================================================================

  /**
   * What we STORE:
   * 1. Current merkle root (on-chain + local cache)
   * 2. Position states (trader -> leaf data)
   * 3. Recent merkle roots (for proof verification)
   * 4. Position index mapping (trader -> tree index)
   * 
   * What we DON'T store:
   * 1. Full merkle tree structure
   * 2. All intermediate nodes
   * 3. Complete historical trees
   */

  // ====================================================================
  // POSITION MANAGEMENT
  // ====================================================================

  /**
   * Deterministic index generation for positions
   * This ensures same trader+asset always gets same tree index
   */
  private getPositionIndex(trader: string, assetId: number): number {
    const key = `${trader.toLowerCase()}-${assetId}`;
    const hash = BigInt(`0x${Buffer.from(key).toString('hex').slice(0, 10)}`);
    return Number(hash % BigInt(this.MAX_POSITIONS));
  }

  /**
   * Hash a position leaf
   */
  hashLeaf(leaf: Leaf): bigint {
    return poseidon([leaf.size, leaf.margin, leaf.entryFunding]);
  }

  /**
   * Update position in tree (this is what executor bot calls)
   */
  updatePosition(trader: string, assetId: number, leaf: Leaf): bigint {
    const key = `${trader.toLowerCase()}-${assetId}`;
    const index = this.getPositionIndex(trader, assetId);
    const leafHash = this.hashLeaf(leaf);

    // Update tree at deterministic index
    this.tree.update(index, leafHash);

    // Store position state
    this.positionStates.set(key, {
      trader,
      assetId,
      leaf,
      index,
      lastUpdated: Date.now()
    });

    const newRoot = this.tree.root;
    this.merkleRoots.push(newRoot);

    // Keep only last 1000 roots for verification
    if (this.merkleRoots.length > 1000) {
      this.merkleRoots = this.merkleRoots.slice(-1000);
    }

    console.log(`📝 Updated position ${key} at index ${index}, new root: ${newRoot}`);
    return newRoot;
  }

  /**
   * Remove position from tree
   */
  removePosition(trader: string, assetId: number): bigint {
    return this.updatePosition(trader, assetId, {
      size: 0n,
      margin: 0n,
      entryFunding: 0n
    });
  }

  // ====================================================================
  // PROOF GENERATION & VERIFICATION
  // ====================================================================

  /**
   * Generate merkle proof for a position
   * This proves a position exists in the tree
   */
  generateProof(trader: string, assetId: number): MerkleProof | null {
    const key = `${trader.toLowerCase()}-${assetId}`;
    const positionState = this.positionStates.get(key);
    
    if (!positionState) {
      return null;
    }

    const proof = this.tree.createProof(positionState.index);
    const leafHash = this.hashLeaf(positionState.leaf);

    return {
      leaf: leafHash,
      pathElements: proof.siblings.map(s => BigInt(s.toString())),
      pathIndices: proof.pathIndices,
      root: this.tree.root
    };
  }

  /**
   * Verify a merkle proof
   * This confirms a position was included in a specific root
   */
  static verifyProof(proof: MerkleProof): boolean {
    let computedHash = proof.leaf;
    
    for (let i = 0; i < proof.pathElements.length; i++) {
      const sibling = proof.pathElements[i];
      const isLeft = proof.pathIndices[i] === 0;
      
      computedHash = isLeft 
        ? poseidon([computedHash, sibling])
        : poseidon([sibling, computedHash]);
    }
    
    return computedHash === proof.root;
  }

  /**
   * Verify position exists in current tree
   */
  verifyPosition(trader: string, assetId: number): boolean {
    const proof = this.generateProof(trader, assetId);
    return proof ? OptimizedMerkleTreeManager.verifyProof(proof) : false;
  }

  // ====================================================================
  // CONTRACT INTEGRATION
  // ====================================================================

  /**
   * Get current root to submit to contract
   */
  getCurrentRoot(): bigint {
    return this.tree.root;
  }

  /**
   * Verify if a root exists in our history
   */
  isValidHistoricalRoot(root: bigint): boolean {
    return this.merkleRoots.includes(root);
  }

  /**
   * Get position state for contract verification
   */
  getPositionState(trader: string, assetId: number): PositionState | null {
    const key = `${trader.toLowerCase()}-${assetId}`;
    return this.positionStates.get(key) || null;
  }

  /**
   * Batch update multiple positions (for settlement)
   */
  batchUpdatePositions(updates: Array<{
    trader: string;
    assetId: number;
    leaf: Leaf;
  }>): bigint {
    console.log(`📦 Batch updating ${updates.length} positions...`);
    
    for (const update of updates) {
      const key = `${update.trader.toLowerCase()}-${update.assetId}`;
      const index = this.getPositionIndex(update.trader, update.assetId);
      const leafHash = this.hashLeaf(update.leaf);

      // Update tree
      this.tree.update(index, leafHash);

      // Store state
      this.positionStates.set(key, {
        trader: update.trader,
        assetId: update.assetId,
        leaf: update.leaf,
        index,
        lastUpdated: Date.now()
      });
    }

    const newRoot = this.tree.root;
    this.merkleRoots.push(newRoot);

    console.log(`✅ Batch update complete, new root: ${newRoot}`);
    return newRoot;
  }

  // ====================================================================
  // PERSISTENCE & RECOVERY
  // ====================================================================

  /**
   * Export minimal state for persistence
   * Only store what's absolutely necessary
   */
  exportState(): {
    positions: Record<string, PositionState>;
    currentRoot: string;
    recentRoots: string[];
  } {
    return {
      positions: Object.fromEntries(this.positionStates),
      currentRoot: this.tree.root.toString(),
      recentRoots: this.merkleRoots.slice(-100).map(r => r.toString()) // Last 100 roots
    };
  }

  /**
   * Import state from persistence
   * Rebuild tree from position states
   */
  importState(state: {
    positions: Record<string, PositionState>;
    currentRoot: string;
    recentRoots: string[];
  }): void {
    console.log('📥 Importing merkle tree state...');

    // Clear current state
    this.positionStates.clear();
    this.merkleRoots = [];
    this.tree = new IncrementalMerkleTree(poseidon, this.TREE_DEPTH, 0n, 2);

    // Rebuild positions
    for (const [key, positionState] of Object.entries(state.positions)) {
      this.positionStates.set(key, positionState);
      
      // Rebuild tree
      const leafHash = this.hashLeaf(positionState.leaf);
      this.tree.update(positionState.index, leafHash);
    }

    // Import recent roots
    this.merkleRoots = state.recentRoots.map(r => BigInt(r));

    // Verify integrity
    const computedRoot = this.tree.root;
    const expectedRoot = BigInt(state.currentRoot);
    
    if (computedRoot !== expectedRoot) {
      throw new Error(`Root mismatch: computed ${computedRoot}, expected ${expectedRoot}`);
    }

    console.log(`✅ State imported successfully, root: ${computedRoot}`);
  }

  // ====================================================================
  // ANALYTICS & MONITORING
  // ====================================================================

  /**
   * Get tree statistics
   */
  getStats(): {
    totalPositions: number;
    currentRoot: string;
    treeDepth: number;
    maxPositions: number;
    utilizationPercent: number;
    rootHistory: number;
  } {
    const nonZeroPositions = Array.from(this.positionStates.values())
      .filter(p => p.leaf.size !== 0n || p.leaf.margin !== 0n).length;

    return {
      totalPositions: nonZeroPositions,
      currentRoot: this.tree.root.toString(),
      treeDepth: this.TREE_DEPTH,
      maxPositions: this.MAX_POSITIONS,
      utilizationPercent: (nonZeroPositions / this.MAX_POSITIONS) * 100,
      rootHistory: this.merkleRoots.length
    };
  }

  /**
   * Get all active positions
   */
  getActivePositions(): PositionState[] {
    return Array.from(this.positionStates.values())
      .filter(p => p.leaf.size !== 0n || p.leaf.margin !== 0n);
  }

  /**
   * Verify tree integrity
   */
  verifyIntegrity(): boolean {
    try {
      // Rebuild tree from scratch and compare root
      const testTree = new IncrementalMerkleTree(poseidon, this.TREE_DEPTH, 0n, 2);
      
      for (const positionState of this.positionStates.values()) {
        const leafHash = this.hashLeaf(positionState.leaf);
        testTree.update(positionState.index, leafHash);
      }

      return testTree.root === this.tree.root;
    } catch (error) {
      console.error('Tree integrity check failed:', error);
      return false;
    }
  }
}

// ====================================================================
// CONTRACT VERIFICATION FUNCTIONS
// ====================================================================

/**
 * Function to verify position inclusion on-chain
 * This would be called by smart contracts
 */
export function verifyPositionInclusion(
  trader: string,
  assetId: number,
  leaf: Leaf,
  proof: MerkleProof,
  contractRoot: bigint
): boolean {
  // 1. Verify the leaf hash
  const expectedLeafHash = poseidon([leaf.size, leaf.margin, leaf.entryFunding]);
  if (expectedLeafHash !== proof.leaf) {
    return false;
  }

  // 2. Verify the merkle proof
  if (!OptimizedMerkleTreeManager.verifyProof(proof)) {
    return false;
  }

  // 3. Verify against contract root
  if (proof.root !== contractRoot) {
    return false;
  }

  console.log(`✅ Position verified for ${trader}-${assetId}`);
  return true;
}

/**
 * Sync verification with contract
 * Ensures our local tree matches contract state
 */
export async function syncWithContract(
  merkleManager: OptimizedMerkleTreeManager,
  contractRoot: bigint
): Promise<boolean> {
  const localRoot = merkleManager.getCurrentRoot();
  
  if (localRoot === contractRoot) {
    console.log('✅ Tree synchronized with contract');
    return true;
  }

  // Check if contract root exists in our history
  if (merkleManager.isValidHistoricalRoot(contractRoot)) {
    console.log('⚠️ Contract root is from our history - possible reorg');
    return true;
  }

  console.error(`❌ Tree out of sync: local=${localRoot}, contract=${contractRoot}`);
  return false;
}

// ====================================================================
// TRADE VERIFICATION UTILITIES
// ====================================================================

/**
 * Verify a trade was executed and included in merkle tree
 */
export function verifyTradeExecution(
  merkleManager: OptimizedMerkleTreeManager,
  trader: string,
  assetId: number,
  expectedLeaf: Leaf
): {
  verified: boolean;
  proof?: MerkleProof;
  currentState?: PositionState;
} {
  const currentState = merkleManager.getPositionState(trader, assetId);
  
  if (!currentState) {
    return { verified: false };
  }

  // Check if current state matches expected
  const stateMatches = 
    currentState.leaf.size === expectedLeaf.size &&
    currentState.leaf.margin === expectedLeaf.margin &&
    currentState.leaf.entryFunding === expectedLeaf.entryFunding;

  if (!stateMatches) {
    return { verified: false, currentState };
  }

  // Generate proof
  const proof = merkleManager.generateProof(trader, assetId);
  
  return {
    verified: !!proof && OptimizedMerkleTreeManager.verifyProof(proof),
    proof: proof || undefined,
    currentState
  };
}

export { OptimizedMerkleTreeManager };