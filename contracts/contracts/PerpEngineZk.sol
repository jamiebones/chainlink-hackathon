// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Ownable}          from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard}  from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IPerpEngine {
    function applyNetDelta(uint8 assetId, int256 qtyDelta, int256 marginDelta) external;
    function liquidateFromZK(address user, uint8 assetId, int256 size, uint256 margin) external;
}

interface IVerifier {
    function verifyProof(
        uint[2] calldata a,
        uint[2][2] calldata b,
        uint[2] calldata c,
        uint[1] calldata input
    ) external view returns (bool);
}

/// @title Simple Privacy Layer for PerpEngine
/// @notice Minimal ZK contract that only handles merkle roots and forwards net deltas to PerpEngine
contract PerpEngineZk is ReentrancyGuard {


    struct Asset {
        bytes32 root;          // Poseidon Merkle root of trader positions
        uint40  lastUpdate;    // Last root update timestamp
    }

    IERC20 private usdcContract;

    /// Mapping asset-ID → state  
    mapping(uint8 => Asset) public asset;

    /*───────────────────
          CONSTANTS
    ───────────────────*/

    IVerifier public verifier;
    IPerpEngine public immutable perpEngine;
    address public immutable owner;
    event RootUpdated(uint8 indexed assetId, bytes32 oldRoot, bytes32 newRoot);
    event BatchProcessed(uint8[] assetIds, int256[] netDeltas, int256[] marginDeltas);
    event LiquidationVerified(address indexed trader, uint8 indexed assetId, int256 size);

    /*───────────────────
       CONSTRUCTOR
    ───────────────────*/

    constructor(address _verifier, address _perpEngine, address _usdc) {
        owner = msg.sender;
        verifier = IVerifier(_verifier);
        perpEngine = IPerpEngine(_perpEngine);
        usdcContract = IERC20(_usdc);
        usdcContract.approve(_perpEngine, type(uint256).max);
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    /*-------------------
       BATCH PROCESSING - Called by Executor Bot
    -------------------*/

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
        // require(a.root == oldRoot, "stale root");
        
        a.root = newRoot;
        a.lastUpdate = uint40(block.timestamp);
        
        emit RootUpdated(assetId, oldRoot, newRoot);
    }

    /*-------------------
       ZK LIQUIDATION
    -------------------*/

    function verifyAndLiquidate(
    uint8 assetId,
    bytes32 oldRoot,
    bytes32 newRoot,
    address trader,
    int256 sizeToClose,
    uint256 marginToTransfer,
    uint[2] calldata a,
    uint[2][2] calldata b,
    uint[2] calldata c,
    uint[1] calldata publicInputs
    ) external nonReentrant {
        Asset storage a_ = asset[assetId];
        require(a_.root == oldRoot, "stale root");
        require(verifier.verifyProof(a, b, c, publicInputs), "invalid proof");
        a_.root = newRoot;
        a_.lastUpdate = uint40(block.timestamp);
        perpEngine.liquidateFromZK(trader, assetId, sizeToClose, marginToTransfer);
        emit RootUpdated(assetId, oldRoot, newRoot);
        emit LiquidationVerified(trader, assetId, sizeToClose);
    }


    function getCurrentRoot(uint8 assetId) external view returns (bytes32) {
        return asset[assetId].root;
    }

    function getAssetInfo(uint8 assetId) external view returns (bytes32 root, uint40 lastUpdate) {
        Asset storage a = asset[assetId];
        return (a.root, a.lastUpdate);
    }

    function initializeAsset(uint8 assetId, bytes32 initialRoot) external onlyOwner {
        asset[assetId].root = initialRoot;
        asset[assetId].lastUpdate = uint40(block.timestamp);
        emit RootUpdated(assetId, bytes32(0), initialRoot);
    }

    function setVerifier(address _verifier) external onlyOwner {
        verifier = IVerifier(_verifier);
    }
}
