// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { LiquidityPool } from "./LiquidityPool.sol";
import { ChainlinkManager } from "./ChainlinkManager.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import { Utils } from "../lib/Utils.sol";
import { FixedPointMathLib } from "solmate/src/utils/FixedPointMathLib.sol";

/// @title PerpMarket
/// @notice Handles leveraged perpetual trading for a specific synthetic asset (e.g., sTSLA).
/// Supports opening, reducing, closing, and liquidating positions, with funding rate adjustments.
contract PerpMarket is Ownable {
    using FixedPointMathLib for uint256;

    // --- Custom Errors ---
    error OnlyVault();
    error AlreadyOpen();
    error ZeroCollateral();
    error InvalidLeverage();
    error ExceedsUtilization();
    error EmptyPool();
    error InvalidPrice();
    error NoPosition();
    error LossExceeded();
    error NotLiquidatable();

    // --- Position Struct ---
    struct Position {
        uint256 sizeUsd;             // Notional size in USD (collateral * leverage)
        uint256 entryPrice;          // Oracle price when position was opened
        uint256 collateral;          // USDC collateral backing the position
        bool isLong;                 // Position direction (long or short)
        uint256 entryFundingRate;    // Funding rate at entry, used to compute funding impact
    }

    // --- State Variables ---
    IERC20 public collateralToken;           // USDC token
    ChainlinkManager public oracle;          // Chainlink oracle manager
    LiquidityPool public pool;               // Liquidity pool providing margin capital
    address public vault;                    // Address allowed to open hedging positions
    Utils.Asset public asset;                // Enum value identifying the synthetic asset (e.g., TSLA)

    uint256 public minCollateralRatioBps = 1000; // 10% minimum collateral ratio (bps)
    uint256 public fundingRatePerHour = 50;      // 0.5% per hour funding rate (bps)
    uint256 public maxUtilizationBps = 8000;     // 80% max pool utilization (bps)

    uint256 public cumulativeFundingRate;        // Global cumulative funding index
    uint256 public lastFundingUpdate;            // Timestamp of last funding rate update

    mapping(address => Position) public positions; // Active positions by trader

    // --- Events ---
    event PositionOpened(address indexed user, uint256 sizeUsd, uint256 collateral, uint256 entryPrice, bool isLong);
    event PositionIncreased(address indexed user, uint256 newSizeUsd, uint256 newCollateral);
    event PositionReduced(address indexed user, uint256 reducedSizeUsd, uint256 remainingSizeUsd, int256 pnl);
    event PositionClosed(address indexed user, uint256 finalCollateral, int256 pnl);
    event PositionLiquidated(address indexed user, uint256 penalty);

    // --- Modifiers ---
    modifier onlyVault() {
        if (msg.sender != vault) revert OnlyVault();
        _;
    }

    constructor(address _collateral, address _oracle, address _pool, address _vault, Utils.Asset _asset) Ownable(msg.sender) {
        collateralToken = IERC20(_collateral);
        oracle = ChainlinkManager(_oracle);
        pool = LiquidityPool(_pool);
        vault = _vault;
        asset = _asset;
        lastFundingUpdate = block.timestamp;
    }

    /// @notice Fetch current Chainlink oracle price for the asset
    function getPrice() public view returns (uint256) {
        uint256 price = oracle.getPrice(asset);
        if (price <= 0) revert InvalidPrice();
        return price;
    }

    /// @notice Updates the global cumulative funding rate based on time elapsed
    function updateFundingRate() public {
        uint256 elapsed = block.timestamp - lastFundingUpdate;
        if (elapsed == 0) return;

        uint256 hourlyRate = fundingRatePerHour * 1e14; // Convert bps to 1e18 format
        uint256 increment = hourlyRate * elapsed / 3600;

        cumulativeFundingRate += increment;
        lastFundingUpdate = block.timestamp;
    }

    /// @notice Checks if pool utilization after opening would exceed cap
    function _validateUtilization(uint256 newSizeUsd) internal view {
        uint256 total = pool.totalLiquidity();
        uint256 reserved = pool.reservedLiquidity();
        if (total == 0) revert EmptyPool();

        uint256 newUtil = (reserved + newSizeUsd).mulDivDown(10000, total);
        if (newUtil > maxUtilizationBps) revert ExceedsUtilization();
    }

    /// @notice Open a leveraged long or short position
    function openPosition(uint256 collateralAmount, uint256 leverage, bool isLong) external {
        updateFundingRate();

        if (positions[msg.sender].sizeUsd > 0) revert AlreadyOpen();
        if (collateralAmount == 0) revert ZeroCollateral();
        if (leverage < 1e6 || leverage > 10e6) revert InvalidLeverage();

        uint256 price = getPrice();
        uint256 sizeUsd = collateralAmount.mulDivDown(leverage, 1e6);
        _validateUtilization(sizeUsd);

        collateralToken.transferFrom(msg.sender, address(pool), collateralAmount);
        pool.reserve(sizeUsd);

        positions[msg.sender] = Position({
            sizeUsd: sizeUsd,
            entryPrice: price,
            collateral: collateralAmount,
            isLong: isLong,
            entryFundingRate: cumulativeFundingRate
        });

        emit PositionOpened(msg.sender, sizeUsd, collateralAmount, price, isLong);
    }

    /// @notice Vault-only function to open a 1x long hedge for synthetic minting
    function openVaultHedge(uint256 collateralAmount) external onlyVault {
        updateFundingRate();

        if (positions[msg.sender].sizeUsd > 0) revert AlreadyOpen();

        uint256 price = getPrice();
        _validateUtilization(collateralAmount);

        collateralToken.transferFrom(msg.sender, address(pool), collateralAmount);
        pool.reserve(collateralAmount);

        positions[msg.sender] = Position({
            sizeUsd: collateralAmount,
            entryPrice: price,
            collateral: collateralAmount,
            isLong: true,
            entryFundingRate: cumulativeFundingRate
        });

        emit PositionOpened(msg.sender, collateralAmount, collateralAmount, price, true);
    }

    /// @dev Applies funding rate adjustment to the position's collateral
    function _applyFunding(Position storage p) internal {
        if (p.sizeUsd == 0) return;

        uint256 fundingCost = p.sizeUsd.mulDivDown(cumulativeFundingRate - p.entryFundingRate, 1e18);

        if (p.isLong) {
            if (fundingCost >= p.collateral) revert LossExceeded();
            p.collateral -= fundingCost;
        } else {
            p.collateral += fundingCost;
        }

        p.entryFundingRate = cumulativeFundingRate;
    }

    /// @notice Reduce a position partially by size in USD
    function reducePosition(uint256 reduceSizeUsd) external {
        updateFundingRate();

        Position storage p = positions[msg.sender];
        if (p.sizeUsd == 0) revert NoPosition();
        require(reduceSizeUsd > 0 && reduceSizeUsd <= p.sizeUsd, "Invalid reduce amount");

        _applyFunding(p);

        uint256 price = getPrice();
        uint256 sizeClosed = reduceSizeUsd;
        uint256 collateralPortion = p.collateral.mulDivDown(sizeClosed, p.sizeUsd);

        uint256 priceRatio = price.mulDivDown(1e18, p.entryPrice);
        int256 pnl = p.isLong
            ? int256(sizeClosed.mulDivDown(priceRatio, 1e18)) - int256(sizeClosed)
            : int256(sizeClosed) - int256(sizeClosed.mulDivDown(priceRatio, 1e18));

        int256 returned = int256(collateralPortion) + pnl;
        if (returned <= 0) revert LossExceeded();

        p.sizeUsd -= sizeClosed;
        p.collateral -= collateralPortion;

        pool.releaseTo(msg.sender, uint256(returned));

        emit PositionReduced(msg.sender, sizeClosed, p.sizeUsd, pnl);

        if (p.sizeUsd == 0) {
            emit PositionClosed(msg.sender, uint256(returned), pnl);
            delete positions[msg.sender];
        }
    }

    /// @notice Close a position completely and release final collateral
    function closePosition() external {
        updateFundingRate();

        Position memory p = positions[msg.sender];
        if (p.sizeUsd == 0) revert NoPosition();

        _applyFunding(positions[msg.sender]);

        uint256 price = getPrice();
        uint256 priceRatio = price.mulDivDown(1e18, p.entryPrice);
        int256 pnl = p.isLong
            ? int256(p.sizeUsd.mulDivDown(priceRatio, 1e18)) - int256(p.sizeUsd)
            : int256(p.sizeUsd) - int256(p.sizeUsd.mulDivDown(priceRatio, 1e18));

        int256 finalCollateral = int256(p.collateral) + pnl;
        if (finalCollateral <= 0) revert LossExceeded();

        delete positions[msg.sender];
        pool.releaseTo(msg.sender, uint256(finalCollateral));

        emit PositionClosed(msg.sender, uint256(finalCollateral), pnl);
    }

    /// @notice Returns unrealized PnL for a given user's position
    function getPnL(address user) external view returns (int256) {
        Position memory p = positions[user];
        if (p.sizeUsd == 0) return 0;

        uint256 price = getPrice();
        uint256 priceRatio = price.mulDivDown(1e18, p.entryPrice);
        return p.isLong
            ? int256(p.sizeUsd.mulDivDown(priceRatio, 1e18)) - int256(p.sizeUsd)
            : int256(p.sizeUsd) - int256(p.sizeUsd.mulDivDown(priceRatio, 1e18));
    }

    /// @notice Determines whether the user is eligible for liquidation
    function isLiquidatable(address user) public view returns (bool) {
        Position memory p = positions[user];
        if (p.sizeUsd == 0) return false;

        uint256 price = getPrice();
        uint256 priceRatio = price.mulDivDown(1e18, p.entryPrice);
        int256 pnl = p.isLong
            ? int256(p.sizeUsd.mulDivDown(priceRatio, 1e18)) - int256(p.sizeUsd)
            : int256(p.sizeUsd) - int256(p.sizeUsd.mulDivDown(priceRatio, 1e18));

        int256 finalCollateral = int256(p.collateral) + pnl;
        if (finalCollateral <= 0) return true;

        uint256 ratio = uint256(finalCollateral).mulDivDown(1e6 * 10000, p.sizeUsd);
        return ratio < minCollateralRatioBps;
    }

    /// @notice Liquidates a position that falls below the minimum collateral ratio
    function liquidate(address user) external {
        updateFundingRate();

        if (!isLiquidatable(user)) revert NotLiquidatable();

        Position memory p = positions[user];
        delete positions[user];

        uint256 penalty = p.collateral.mulDivDown(5, 100);
        pool.releaseTo(msg.sender, penalty);
        pool.releaseTo(address(pool), p.collateral - penalty);

        emit PositionLiquidated(user, penalty);
    }

    /// @notice Admin function to adjust funding rate per hour (bps)
    function setFundingRatePerHour(uint256 newRate) external onlyOwner {
        fundingRatePerHour = newRate;
    }
}