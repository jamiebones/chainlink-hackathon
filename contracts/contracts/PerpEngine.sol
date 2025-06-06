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

    // --- Fee Parameters (bps-based) ---
    uint256 public openFeeBps = 10;         // 0.10%
    uint256 public closeFeeBps = 10;        // 0.10%
    uint256 public liquidationPenaltyBps = 200; // 2.00%

    uint256 public minCollateralRatioBps = 1000; // 10% minimum collateral ratio (bps)
    uint256 public fundingRatePerHour = 50;      // 0.5% per hour funding rate (bps)
    uint256 public maxUtilizationBps = 8000;     // 80% max pool utilization (bps)

    // --- State Variables ---
    IERC20 public collateralToken;           // USDC token
    ChainlinkManager public oracle;          // Chainlink oracle manager
    LiquidityPool public pool;               // Liquidity pool providing margin capital
    address public vault;                    // Address allowed to open hedging positions
    Utils.Asset public asset;                // Enum value identifying the synthetic asset (e.g., TSLA)

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

    function setOpenFeeBps(uint256 bps) external onlyOwner {
        openFeeBps = bps;
    }

    function setCloseFeeBps(uint256 bps) external onlyOwner {
        closeFeeBps = bps;
    }

    function setLiquidationPenaltyBps(uint256 bps) external onlyOwner {
        liquidationPenaltyBps = bps;
    }

    /// @notice Admin function to adjust funding rate per hour (bps)
    function setFundingRatePerHour(uint256 newRate) external onlyOwner {
        fundingRatePerHour = newRate;
    }

    /// @notice Admin function to adjust minimum collateral ratio (bps)
    function setMinCollateralRatioBps(uint256 newRatio) external onlyOwner {
        minCollateralRatioBps = newRatio;
    }

    /// @notice Admin function to adjust maximum utilization ratio (bps)
    function setMaxUtilizationBps(uint256 newRatio) external onlyOwner {
        maxUtilizationBps = newRatio;
    }

    /// @notice Fetch current Chainlink oracle price for the asset
    function getPrice() public view returns (uint256) {
        uint256 price = oracle.getPrice(asset);
        if (price <= 0) revert InvalidPrice();
        return price;
    }

    /// @notice Updates the global cumulative funding rate based on time elapsed
    /// @dev This is a flat funding model, charging longs and rewarding shorts uniformly over time.
    /// The funding rate is expressed in basis points (bps) per hour.
    /// This function should be called before any position activity (open/close/modify).
    function updateFundingRate() public {
        // Time elapsed since last funding update (in seconds)
        uint256 elapsed = block.timestamp - lastFundingUpdate;

        // Skip update if called within the same block/timestamp
        if (elapsed == 0) return;

        // Convert fundingRatePerHour (in BPS) to 18-decimal format:
        // Example: 50 bps = 0.5% = 0.005 * 1e18 = 5e15
        uint256 hourlyRate = fundingRatePerHour * 1e14;

        // Funding increment for elapsed time:
        // If 3600s (1 hr) => full hourlyRate
        // If 1800s (30 mins) => 50% of hourlyRate
        uint256 increment = hourlyRate * elapsed / 3600;

        // Accumulate global funding index
        // This acts as a running total for funding costs
        cumulativeFundingRate += increment;

        // Update timestamp of last funding update
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

        // --- Calculate & apply open fee (on sizeUsd) ---
        uint256 openFee = sizeUsd.mulDivDown(openFeeBps, 10000);

        // Transfer total collateral + open fee to pool
        collateralToken.transferFrom(msg.sender, address(pool), collateralAmount + openFee);

        // Fee goes to pool directly
        pool.reserve(sizeUsd);

        positions[msg.sender] = Position({
            sizeUsd: sizeUsd,
            entryPrice: price,
            collateral: collateralAmount, // fee is not counted as user collateral
            isLong: isLong,
            entryFundingRate: cumulativeFundingRate
        });

        emit PositionOpened(msg.sender, sizeUsd, collateralAmount, price, isLong);
    }

    /// @notice Vault-only function to open or increase a 1x long hedge for synthetic minting
    function openVaultHedge(uint256 collateralAmount) external onlyVault {
        updateFundingRate();
        require(collateralAmount > 0, "Zero amount");

        Position storage p = positions[msg.sender];

        uint256 price = getPrice();
        uint256 sizeUsd = collateralAmount; // 1x leverage => size = collateral

        _validateUtilization(sizeUsd);

        // Transfer USDC from vault to pool
        collateralToken.transferFrom(msg.sender, address(pool), collateralAmount);
        pool.reserve(sizeUsd);

        if (p.sizeUsd == 0) {
            // --- Open new hedge position ---
            positions[msg.sender] = Position({
                sizeUsd: sizeUsd,
                entryPrice: price,
                collateral: collateralAmount,
                isLong: true,
                entryFundingRate: cumulativeFundingRate
            });

            emit PositionOpened(msg.sender, sizeUsd, collateralAmount, price, true);
        } else {
            // --- Increase existing hedge position ---
            _applyFunding(p); // apply funding delta to update collateral and reset funding base

            // Compute new weighted average entry price
            p.entryPrice = (p.entryPrice * p.sizeUsd + price * sizeUsd) / (p.sizeUsd + sizeUsd);
            p.sizeUsd += sizeUsd;
            p.collateral += collateralAmount;
            p.entryFundingRate = cumulativeFundingRate;

            emit PositionIncreased(msg.sender, p.sizeUsd, p.collateral);
        }
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
        _applyFunding(positions[msg.sender]);

        Position storage p = positions[msg.sender];
        if (p.sizeUsd == 0) revert NoPosition();
        require(reduceSizeUsd > 0 && reduceSizeUsd <= p.sizeUsd, "Invalid reduce amount");

        uint256 price = getPrice();
        uint256 sizeClosed = reduceSizeUsd;
        uint256 collateralPortion = p.collateral.mulDivDown(sizeClosed, p.sizeUsd);

        uint256 priceRatio = price.mulDivDown(1e18, p.entryPrice);
        int256 pnl = p.isLong
            ? int256(sizeClosed.mulDivDown(priceRatio, 1e18)) - int256(sizeClosed)
            : int256(sizeClosed) - int256(sizeClosed.mulDivDown(priceRatio, 1e18));

        int256 returned = int256(collateralPortion) + pnl;
        if (returned <= 0) revert LossExceeded();

        // --- Apply close fee on reduced portion ---
        uint256 closeFee = uint256(returned).mulDivDown(closeFeeBps, 10000);
        uint256 netReturn = uint256(returned) - closeFee;

        p.sizeUsd -= sizeClosed;
        p.collateral -= collateralPortion;

        // Send fee to pool, rest to trader
        pool.releaseTo(address(pool), closeFee);
        pool.releaseTo(msg.sender, netReturn);

        emit PositionReduced(msg.sender, sizeClosed, p.sizeUsd, pnl);

        if (p.sizeUsd == 0) {
            emit PositionClosed(msg.sender, uint256(returned), pnl);
            delete positions[msg.sender];
        }
    }

    /// @notice Close a position completely and release final collateral
    function closePosition() external {
        updateFundingRate();
        _applyFunding(positions[msg.sender]);

        Position memory p = positions[msg.sender];
        if (p.sizeUsd == 0) revert NoPosition();

        uint256 price = getPrice();
        uint256 priceRatio = price.mulDivDown(1e18, p.entryPrice);

        int256 pnl = p.isLong
            ? int256(p.sizeUsd.mulDivDown(priceRatio, 1e18)) - int256(p.sizeUsd)
            : int256(p.sizeUsd) - int256(p.sizeUsd.mulDivDown(priceRatio, 1e18));

        int256 finalCollateral = int256(p.collateral) + pnl;
        if (finalCollateral <= 0) revert LossExceeded();

        // --- Apply close fee ---
        uint256 closeFee = uint256(finalCollateral).mulDivDown(closeFeeBps, 10000);

        delete positions[msg.sender];

        // Send fee to pool, remainder to trader
        pool.releaseTo(address(pool), closeFee);
        pool.releaseTo(msg.sender, uint256(finalCollateral) - closeFee);

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

        // Apply liquidation penalty to collateral
        uint256 penalty = p.collateral.mulDivDown(liquidationPenaltyBps, 10000);

        // Reward liquidator with penalty, send rest to pool
        pool.releaseTo(msg.sender, penalty);
        pool.releaseTo(address(pool), p.collateral - penalty);

        emit PositionLiquidated(user, penalty);
    }
}