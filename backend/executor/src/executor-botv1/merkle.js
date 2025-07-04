"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.merkleTree = exports.PoseidonMerkleTree = void 0;
var imt_1 = require("@zk-kit/imt");
var poseidon_lite_1 = require("poseidon-lite");
var database_1 = require("./database");
var PoseidonMerkleTree = /** @class */ (function () {
    function PoseidonMerkleTree() {
        this.TREE_DEPTH = 20; // Support up to 2^20 = ~1M positions
        this.ZERO_VALUE = BigInt(0);
        this.ARITY = 2; // Binary tree
        // Map to track position hash to leaf index
        this.positionToIndex = new Map();
        console.log('🌳 Initializing Poseidon Merkle Tree...');
        // Initialize IMT with poseidon2 for binary tree hashing
        this.tree = new imt_1.IMT(poseidon_lite_1.poseidon2, this.TREE_DEPTH, this.ZERO_VALUE, this.ARITY);
        // Restore state from database if exists
        this.restoreFromDatabase();
        console.log('✅ Poseidon Merkle Tree initialized');
        console.log("\uD83C\uDF33 Current root: ".concat(this.getCurrentRootHex()));
    }
    // ====================================================================
    // POSITION MANAGEMENT
    // ====================================================================
    /**
     * Add or update a position in the merkle tree
     */
    PoseidonMerkleTree.prototype.updatePosition = function (position) {
        console.log("\uD83C\uDF33 Updating position: ".concat(position.trader, " asset ").concat(position.assetId));
        var positionHash = this.hashPosition(position);
        var positionKey = "".concat(position.trader.toLowerCase(), "-").concat(position.assetId);
        // Check if position already exists
        var existingIndex = this.positionToIndex.get(positionKey);
        if (existingIndex !== undefined) {
            // Update existing position
            this.tree.update(existingIndex, positionHash);
            console.log("\uD83D\uDD04 Updated existing position at index ".concat(existingIndex));
        }
        else {
            // Insert new position
            this.tree.insert(positionHash);
            var newIndex = this.tree.leaves.length - 1;
            this.positionToIndex.set(positionKey, newIndex);
            console.log("\u2705 Inserted new position at index ".concat(newIndex));
        }
        // Save to database
        database_1.database.savePosition(position);
        console.log("\uD83C\uDF33 New root: ".concat(this.getCurrentRootHex()));
    };
    /**
     * Remove a position from the merkle tree
     */
    PoseidonMerkleTree.prototype.removePosition = function (trader, assetId) {
        var positionKey = "".concat(trader.toLowerCase(), "-").concat(assetId);
        var index = this.positionToIndex.get(positionKey);
        if (index === undefined) {
            console.log("\u274C Position not found: ".concat(positionKey));
            return false;
        }
        // Update to zero (effectively removing)
        this.tree.update(index, this.ZERO_VALUE);
        this.positionToIndex.delete(positionKey);
        console.log("\uD83D\uDDD1\uFE0F Removed position: ".concat(positionKey, " at index ").concat(index));
        console.log("\uD83C\uDF33 New root: ".concat(this.getCurrentRootHex()));
        return true;
    };
    // ====================================================================
    // MERKLE TREE OPERATIONS
    // ====================================================================
    /**
     * Get current merkle root
     */
    PoseidonMerkleTree.prototype.getCurrentRoot = function () {
        return this.toBigInt(this.tree.root);
    };
    /**
     * Get current merkle root as hex string
     */
    PoseidonMerkleTree.prototype.getCurrentRootHex = function () {
        var root = this.getCurrentRoot();
        return "0x".concat(root.toString(16).padStart(64, '0'));
    };
    /**
     * Generate merkle proof for a position
     */
    PoseidonMerkleTree.prototype.generateProof = function (trader, assetId) {
        var _this = this;
        var positionKey = "".concat(trader.toLowerCase(), "-").concat(assetId);
        var leafIndex = this.positionToIndex.get(positionKey);
        if (leafIndex === undefined) {
            console.log("\u274C Position not found for proof: ".concat(positionKey));
            return null;
        }
        try {
            var proof = this.tree.createProof(leafIndex);
            return {
                root: this.toBigInt(proof.root),
                leaf: this.toBigInt(proof.leaf),
                siblings: proof.siblings.map(function (s) { return _this.toBigInt(s); }),
                pathIndices: proof.pathIndices,
                leafIndex: leafIndex
            };
        }
        catch (error) {
            console.error("\u274C Failed to generate proof for ".concat(positionKey, ":"), error);
            return null;
        }
    };
    /**
     * Verify a merkle proof
     */
    PoseidonMerkleTree.prototype.verifyProof = function (proof) {
        try {
            var imtProof = {
                root: proof.root,
                leaf: proof.leaf,
                siblings: proof.siblings,
                pathIndices: proof.pathIndices,
                leafIndex: proof.leafIndex
            };
            return this.tree.verifyProof(imtProof);
        }
        catch (error) {
            console.error('❌ Proof verification failed:', error);
            return false;
        }
    };
    // ====================================================================
    // BATCH OPERATIONS
    // ====================================================================
    /**
     * Update multiple positions in batch
     */
    PoseidonMerkleTree.prototype.batchUpdatePositions = function (positions) {
        console.log("\uD83C\uDF33 Batch updating ".concat(positions.length, " positions..."));
        var oldRoot = this.getCurrentRoot();
        for (var _i = 0, positions_1 = positions; _i < positions_1.length; _i++) {
            var position = positions_1[_i];
            this.updatePosition(position);
        }
        var newRoot = this.getCurrentRoot();
        console.log("\uD83C\uDF33 Batch complete: ".concat(oldRoot.toString(), " \u2192 ").concat(newRoot.toString()));
        return { oldRoot: oldRoot, newRoot: newRoot };
    };
    /**
     * Create checkpoint for rollback
     */
    PoseidonMerkleTree.prototype.createCheckpoint = function () {
        console.log('📸 Creating merkle tree checkpoint...');
        return {
            root: this.getCurrentRoot(),
            positionMap: new Map(this.positionToIndex),
            timestamp: Date.now()
        };
    };
    /**
     * Restore from checkpoint
     */
    PoseidonMerkleTree.prototype.restoreFromCheckpoint = function (checkpoint) {
        console.log('🔄 Restoring from checkpoint...');
        try {
            // Rebuild tree from database positions
            this.rebuildFromDatabase();
            // Restore position mapping
            this.positionToIndex = new Map(checkpoint.positionMap);
            console.log("\u2705 Restored to checkpoint root: ".concat(this.getCurrentRootHex()));
        }
        catch (error) {
            console.error('❌ Failed to restore from checkpoint:', error);
            throw error;
        }
    };
    // ====================================================================
    // POSITION HASHING
    // ====================================================================
    /**
     * Hash position data using Poseidon (iterative approach with poseidon2)
     */
    PoseidonMerkleTree.prototype.hashPosition = function (position) {
        try {
            // Convert trader address properly
            var traderHex = position.trader.replace('0x', '');
            var traderBigInt = BigInt('0x' + traderHex);
            // Hash fields using poseidon2 iteratively to combine all 6 fields
            // First combine trader and assetId
            var hash1 = (0, poseidon_lite_1.poseidon2)([traderBigInt, BigInt(position.assetId)]);
            // Then combine with size and margin  
            var hash2 = (0, poseidon_lite_1.poseidon2)([hash1, position.size]);
            var hash3 = (0, poseidon_lite_1.poseidon2)([hash2, position.margin]);
            // Finally combine with entryPrice and lastUpdate
            var hash4 = (0, poseidon_lite_1.poseidon2)([hash3, position.entryPrice]);
            var finalHash = (0, poseidon_lite_1.poseidon2)([hash4, BigInt(position.lastUpdate)]);
            return finalHash;
        }
        catch (error) {
            console.error('❌ Error hashing position:', error);
            console.error('Position data:', JSON.stringify(position, function (key, value) {
                return typeof value === 'bigint' ? value.toString() : value;
            }));
            throw error;
        }
    };
    /**
     * Calculate position hash for external use
     */
    PoseidonMerkleTree.prototype.calculatePositionHash = function (position) {
        return this.hashPosition(position);
    };
    // ====================================================================
    // DATABASE INTEGRATION
    // ====================================================================
    /**
     * Rebuild tree from database positions
     */
    PoseidonMerkleTree.prototype.rebuildFromDatabase = function () {
        console.log('🔄 Rebuilding merkle tree from database...');
        // Create new tree
        this.tree = new imt_1.IMT(poseidon_lite_1.poseidon2, this.TREE_DEPTH, this.ZERO_VALUE, this.ARITY);
        this.positionToIndex.clear();
        // Get all positions from database
        var allPositions = database_1.database.getAllPositions();
        // Insert all position hashes
        for (var _i = 0, allPositions_1 = allPositions; _i < allPositions_1.length; _i++) {
            var position = allPositions_1[_i];
            var positionHash = this.hashPosition(position);
            this.tree.insert(positionHash);
            var positionKey = "".concat(position.trader.toLowerCase(), "-").concat(position.assetId);
            var index = this.tree.leaves.length - 1;
            this.positionToIndex.set(positionKey, index);
        }
        console.log("\u2705 Tree rebuilt with ".concat(allPositions.length, " positions"));
    };
    /**
     * Restore state from database on startup
     */
    PoseidonMerkleTree.prototype.restoreFromDatabase = function () {
        try {
            console.log('📥 Restoring merkle state from database...');
            var allPositions = database_1.database.getAllPositions();
            if (allPositions.length === 0) {
                console.log('📝 No positions found, starting with empty tree');
                return;
            }
            // Rebuild tree from stored positions
            this.rebuildFromDatabase();
            console.log('✅ Merkle state restored from database');
        }
        catch (error) {
            console.log('📝 No existing merkle state found, starting fresh');
        }
    };
    // ====================================================================
    // UTILITIES
    // ====================================================================
    /**
     * Convert tree node to bigint
     */
    PoseidonMerkleTree.prototype.toBigInt = function (node) {
        if (typeof node === 'bigint')
            return node;
        if (typeof node === 'string')
            return BigInt(node);
        if (typeof node === 'number')
            return BigInt(node);
        throw new Error("Cannot convert ".concat(typeof node, " to bigint"));
    };
    /**
     * Get tree statistics
     */
    PoseidonMerkleTree.prototype.getStats = function () {
        return {
            totalPositions: database_1.database.getAllPositions().length,
            currentRoot: this.getCurrentRootHex(),
            treeDepth: this.TREE_DEPTH,
            leafCount: this.tree.leaves.length,
            positionMappings: this.positionToIndex.size
        };
    };
    /**
     * Get all current leaves
     */
    PoseidonMerkleTree.prototype.getAllLeaves = function () {
        var _this = this;
        return this.tree.leaves.map(function (leaf) { return _this.toBigInt(leaf); });
    };
    /**
     * Find position by hash
     */
    PoseidonMerkleTree.prototype.findPositionByHash = function (hash) {
        // Check if hash exists in tree
        var leaves = this.getAllLeaves();
        var index = leaves.findIndex(function (leaf) { return leaf === hash; });
        if (index === -1)
            return null;
        // Find the position that generates this hash
        var allPositions = database_1.database.getAllPositions();
        for (var _i = 0, allPositions_2 = allPositions; _i < allPositions_2.length; _i++) {
            var position = allPositions_2[_i];
            if (this.hashPosition(position) === hash) {
                return { position: position, index: index };
            }
        }
        return null;
    };
    /**
     * Verify tree integrity
     */
    PoseidonMerkleTree.prototype.verifyIntegrity = function () {
        try {
            var allPositions = database_1.database.getAllPositions();
            console.log("\uD83D\uDD0D Verifying tree integrity for ".concat(allPositions.length, " positions..."));
            // Create temporary tree for comparison
            var tempTree = new imt_1.IMT(poseidon_lite_1.poseidon2, this.TREE_DEPTH, this.ZERO_VALUE, this.ARITY);
            for (var _i = 0, allPositions_3 = allPositions; _i < allPositions_3.length; _i++) {
                var position = allPositions_3[_i];
                var hash = this.hashPosition(position);
                tempTree.insert(hash);
            }
            var currentRoot = this.getCurrentRoot();
            var tempRoot = this.toBigInt(tempTree.root);
            var matches = tempRoot === currentRoot;
            if (matches) {
                console.log('✅ Tree integrity check passed');
            }
            else {
                console.error("\u274C Tree integrity check failed: expected ".concat(tempRoot.toString(), ", got ").concat(currentRoot.toString()));
            }
            return matches;
        }
        catch (error) {
            console.error('❌ Tree integrity check failed:', error);
            return false;
        }
    };
    /**
     * Clear tree (for testing)
     */
    PoseidonMerkleTree.prototype.clear = function () {
        this.tree = new imt_1.IMT(poseidon_lite_1.poseidon2, this.TREE_DEPTH, this.ZERO_VALUE, this.ARITY);
        this.positionToIndex.clear();
        console.log('🧹 Merkle tree cleared');
    };
    /**
     * Get position index
     */
    PoseidonMerkleTree.prototype.getPositionIndex = function (trader, assetId) {
        var _a;
        var positionKey = "".concat(trader.toLowerCase(), "-").concat(assetId);
        return (_a = this.positionToIndex.get(positionKey)) !== null && _a !== void 0 ? _a : null;
    };
    /**
     * Check if position exists in tree
     */
    PoseidonMerkleTree.prototype.hasPosition = function (trader, assetId) {
        return this.getPositionIndex(trader, assetId) !== null;
    };
    /**
     * Get position count
     */
    PoseidonMerkleTree.prototype.getPositionCount = function () {
        return this.positionToIndex.size;
    };
    /**
     * Export tree state for backup
     */
    PoseidonMerkleTree.prototype.exportState = function () {
        return {
            root: this.getCurrentRootHex(),
            leaves: this.getAllLeaves().map(function (leaf) { return leaf.toString(); }),
            positionMap: Object.fromEntries(this.positionToIndex),
            timestamp: Date.now()
        };
    };
    /**
     * Import tree state from backup
     */
    PoseidonMerkleTree.prototype.importState = function (state) {
        console.log('📥 Importing merkle tree state...');
        try {
            // Rebuild from database first to ensure consistency
            this.rebuildFromDatabase();
            // Restore position mapping
            this.positionToIndex = new Map(Object.entries(state.positionMap));
            console.log("\u2705 Imported state from ".concat(new Date(state.timestamp).toISOString()));
        }
        catch (error) {
            console.error('❌ Failed to import state:', error);
            throw error;
        }
    };
    return PoseidonMerkleTree;
}());
exports.PoseidonMerkleTree = PoseidonMerkleTree;
// Export singleton instance
exports.merkleTree = new PoseidonMerkleTree();
