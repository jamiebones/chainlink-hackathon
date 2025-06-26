// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Ownable}          from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard}  from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IPerpEngine {
    function applyNetDelta(uint8 assetId, int256 qtyDelta, int256 marginDelta) external;
    function liquidateFromZK(address user, uint8 assetId) external;
}

interface IVerifier {
    function verify(bytes calldata proof, uint256[] calldata publicInputs) external view returns (bool);
}

/// @title Simple Privacy Layer for PerpEngine
/// @notice Minimal ZK contract that only handles merkle roots and forwards net deltas to PerpEngine
contract PerpEngineZk is ReentrancyGuard {
    /*───────────────────
        DATA STRUCTURES
    ───────────────────*/

    struct Asset {
        bytes32 root;          // Poseidon Merkle root of trader positions
        uint40  lastUpdate;    // Last root update timestamp
    }

    /// Mapping asset-ID → state  
    mapping(uint8 => Asset) public asset;

    /*───────────────────
          CONSTANTS
    ───────────────────*/

    IVerifier public immutable verifier;
    IPerpEngine public immutable perpEngine;
    address public immutable owner;

    /*───────────────────
          EVENTS
    ───────────────────*/

    event RootUpdated(uint8 indexed assetId, bytes32 oldRoot, bytes32 newRoot);
    event BatchProcessed(uint8[] assetIds, int256[] netDeltas, int256[] marginDeltas);
    event LiquidationVerified(address indexed trader, uint8 indexed assetId, int256 size);

    /*───────────────────
       CONSTRUCTOR
    ───────────────────*/

    constructor(address _verifier, address _perpEngine) {
        owner = msg.sender;
        verifier = IVerifier(_verifier);
        perpEngine = IPerpEngine(_perpEngine);
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    /*───────────────────
       BATCH PROCESSING - Called by Executor Bot
    ───────────────────*/

    /**
     * @notice Process batch of private trades
     * @param assetIds Array of asset IDs
     * @param oldRoots Array of current merkle roots
     * @param newRoots Array of new merkle roots after trades
     * @param netDeltas Array of net position changes (positive = net long, negative = net short)
     * @param marginDeltas Array of net margin changes (positive = margin added, negative = margin removed)
     */
    function processBatch(
        uint8[] calldata assetIds,
        bytes32[] calldata oldRoots,
        bytes32[] calldata newRoots,
        int256[] calldata netDeltas,
        int256[] calldata marginDeltas
    ) external onlyOwner nonReentrant {
        require(assetIds.length == oldRoots.length, "length mismatch");
        require(assetIds.length == newRoots.length, "length mismatch");
        require(assetIds.length == netDeltas.length, "length mismatch");
        require(assetIds.length == marginDeltas.length, "length mismatch");

        for (uint256 i = 0; i < assetIds.length; i++) {
            _updateAssetRoot(assetIds[i], oldRoots[i], newRoots[i]);
            
            // Forward net delta to PerpEngine for all accounting
            perpEngine.applyNetDelta(assetIds[i], netDeltas[i], marginDeltas[i]);
        }

        emit BatchProcessed(assetIds, netDeltas, marginDeltas);
    }

    function _updateAssetRoot(uint8 assetId, bytes32 oldRoot, bytes32 newRoot) internal {
        Asset storage a = asset[assetId];
        require(a.root == oldRoot, "stale root");
        
        a.root = newRoot;
        a.lastUpdate = uint40(block.timestamp);
        
        emit RootUpdated(assetId, oldRoot, newRoot);
    }

    /*───────────────────
       ZK LIQUIDATION
    ───────────────────*/

    /**
     * @notice Verify ZK proof for liquidation and forward to PerpEngine
     * @param assetId Asset being liquidated
     * @param oldRoot Current merkle root
     * @param newRoot New merkle root after liquidation
     * @param trader Trader being liquidated
     * @param size Position size being liquidated
     * @param margin Trader's margin
     * @param entryFunding Trader's entry funding rate
     * @param proof ZK-SNARK proof of liquidation eligibility
     */
    function verifyAndLiquidate(
        uint8   assetId,
        bytes32 oldRoot,
        bytes32 newRoot,
        address trader,
        int256  size,
        uint256 margin,
        uint256 entryFunding,
        bytes calldata proof
    ) external nonReentrant {
        Asset storage a = asset[assetId];
        require(a.root == oldRoot, "stale root");

        // Build public inputs for ZK verification
        uint256[6] memory publicInputs;
        publicInputs[0] = uint256(oldRoot);
        publicInputs[1] = uint256(newRoot);
        publicInputs[2] = size < 0 ? uint256(-size) : uint256(size);
        publicInputs[3] = margin;
        publicInputs[4] = entryFunding;
        publicInputs[5] = uint256(uint160(trader)); // Include trader address

        // Convert to dynamic array for verifier
        uint256[] memory pubIns = new uint256[](6);
        for (uint256 i = 0; i < 6; ++i) {
            pubIns[i] = publicInputs[i];
        }

        // Verify ZK proof
        require(verifier.verify(proof, pubIns), "invalid proof");

        // Update merkle root
        a.root = newRoot;
        a.lastUpdate = uint40(block.timestamp);

        // Forward liquidation to PerpEngine (it handles all liquidation logic)
        perpEngine.liquidateFromZK(trader, assetId);

        emit RootUpdated(assetId, oldRoot, newRoot);
        emit LiquidationVerified(trader, assetId, size);
    }

    /*───────────────────
          VIEW FUNCTIONS
    ───────────────────*/

    function getCurrentRoot(uint8 assetId) external view returns (bytes32) {
        return asset[assetId].root;
    }

    function getAssetInfo(uint8 assetId) external view returns (bytes32 root, uint40 lastUpdate) {
        Asset storage a = asset[assetId];
        return (a.root, a.lastUpdate);
    }

    /*───────────────────
          ADMIN FUNCTIONS
    ───────────────────*/

    function initializeAsset(uint8 assetId, bytes32 initialRoot) external onlyOwner {
        asset[assetId].root = initialRoot;
        asset[assetId].lastUpdate = uint40(block.timestamp);
        emit RootUpdated(assetId, bytes32(0), initialRoot);
    }
}