// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { LiquidityPool } from "./LiquidityPool.sol";
import { ChainlinkManager } from "./ChainlinkManager.sol";
import { Utils } from "../lib/Utils.sol";

contract PerpMarket {
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

    struct Position {
        uint256 sizeUsd;
        uint256 entryPrice;
        uint256 collateral;
        bool isLong;
        uint256 lastFundingTime;
    }

    IERC20 public collateralToken;
    ChainlinkManager public oracle;
    LiquidityPool public pool;
    address public vault;
    Utils.Asset public asset;

    uint256 public minCollateralRatioBps = 1000;
    uint256 public fundingRatePerHour = 50;
    uint256 public maxUtilizationBps = 8000;

    mapping(address => Position) public positions;

    event PositionOpened(address indexed user, uint256 sizeUsd, uint256 collateral, uint256 entryPrice, bool isLong);
    event PositionIncreased(address indexed user, uint256 newSizeUsd, uint256 newCollateral);
    event PositionReduced(address indexed user, uint256 reducedSizeUsd, uint256 remainingSizeUsd, int256 pnl);
    event PositionClosed(address indexed user, uint256 finalCollateral, int256 pnl);
    event PositionLiquidated(address indexed user, uint256 penalty);

    modifier onlyVault() {
        if (msg.sender != vault) revert OnlyVault();
        _;
    }

    constructor(address _collateral, address _oracle, address _pool, address _vault, Utils.Asset _asset) {
        collateralToken = IERC20(_collateral);
        oracle = ChainlinkManager(_oracle);
        pool = LiquidityPool(_pool);
        vault = _vault;
        asset = _asset;
    }

    function getPrice() public view returns (uint256) {
        uint256 price = oracle.getPrice(asset);
        if (price <= 0) revert InvalidPrice();
        return price;
    }

    function _applyFunding(Position storage p) internal {
        if (p.sizeUsd == 0) return;
        uint256 elapsed = block.timestamp - p.lastFundingTime;
        if (elapsed == 0) return;

        int256 funding = int256(p.sizeUsd) * int256(fundingRatePerHour) * int256(elapsed) / int256(1e6 * 3600);
        if (p.isLong) {
            p.collateral = p.collateral > uint256(funding) ? p.collateral - uint256(funding) : 0;
        } else {
            p.collateral += uint256(funding);
        }

        p.lastFundingTime = block.timestamp;
    }

    function _validateUtilization(uint256 newSizeUsd) internal view {
        uint256 total = pool.totalLiquidity();
        uint256 reserved = pool.reservedLiquidity();
        if (total == 0) revert EmptyPool();

        uint256 newUtil = ((reserved + newSizeUsd) * 10000) / total;
        if (newUtil > maxUtilizationBps) revert ExceedsUtilization();
    }

    function openPosition(uint256 collateralAmount, uint256 leverage, bool isLong) external {
        if (positions[msg.sender].sizeUsd > 0) revert AlreadyOpen();
        if (collateralAmount == 0) revert ZeroCollateral();
        if (leverage < 1e6 || leverage > 10e6) revert InvalidLeverage();

        uint256 price = getPrice();
        uint256 sizeUsd = (collateralAmount * leverage) / 1e6;
        _validateUtilization(sizeUsd);

        collateralToken.transferFrom(msg.sender, address(pool), collateralAmount);
        pool.reserve(sizeUsd);

        positions[msg.sender] = Position({
            sizeUsd: sizeUsd,
            entryPrice: price,
            collateral: collateralAmount,
            isLong: isLong,
            lastFundingTime: block.timestamp
        });

        emit PositionOpened(msg.sender, sizeUsd, collateralAmount, price, isLong);
    }

    function openVaultHedge(uint256 collateralAmount) external onlyVault {
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
            lastFundingTime: block.timestamp
        });

        emit PositionOpened(msg.sender, collateralAmount, collateralAmount, price, true);
    }

    function reducePosition(uint256 reduceSizeUsd) external {
        Position storage p = positions[msg.sender];
        if (p.sizeUsd == 0) revert NoPosition();
        require(reduceSizeUsd > 0 && reduceSizeUsd <= p.sizeUsd, "Invalid reduce amount");

        _applyFunding(p);

        uint256 price = getPrice();
        uint256 sizeClosed = reduceSizeUsd;
        uint256 collateralPortion = (p.collateral * sizeClosed) / p.sizeUsd;

        int256 pnl = p.isLong
            ? int256(sizeClosed * price / p.entryPrice) - int256(sizeClosed)
            : int256(sizeClosed) - int256(sizeClosed * price / p.entryPrice);

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

    function closePosition() external {
        Position memory p = positions[msg.sender];
        if (p.sizeUsd == 0) revert NoPosition();

        _applyFunding(positions[msg.sender]);

        uint256 price = getPrice();
        int256 pnl = p.isLong
            ? int256(p.sizeUsd * price / p.entryPrice) - int256(p.sizeUsd)
            : int256(p.sizeUsd) - int256(p.sizeUsd * price / p.entryPrice);

        int256 finalCollateral = int256(p.collateral) + pnl;
        if (finalCollateral <= 0) revert LossExceeded();

        delete positions[msg.sender];
        pool.releaseTo(msg.sender, uint256(finalCollateral));

        emit PositionClosed(msg.sender, uint256(finalCollateral), pnl);
    }

    function getPnL(address user) external view returns (int256) {
        Position memory p = positions[user];
        if (p.sizeUsd == 0) return 0;

        uint256 price = getPrice();
        return p.isLong
            ? int256((p.sizeUsd * price / p.entryPrice)) - int256(p.sizeUsd)
            : int256(p.sizeUsd) - int256((p.sizeUsd * price / p.entryPrice));
    }

    function isLiquidatable(address user) public view returns (bool) {
        Position memory p = positions[user];
        if (p.sizeUsd == 0) return false;

        uint256 price = getPrice();
        int256 pnl = p.isLong
            ? int256(p.sizeUsd * price / p.entryPrice) - int256(p.sizeUsd)
            : int256(p.sizeUsd) - int256(p.sizeUsd * price / p.entryPrice);

        int256 finalCollateral = int256(p.collateral) + pnl;
        if (finalCollateral <= 0) return true;

        uint256 ratio = uint256(finalCollateral) * 1e6 * 10000 / p.sizeUsd;
        return ratio < minCollateralRatioBps;
    }

    function liquidate(address user) external {
        if (!isLiquidatable(user)) revert NotLiquidatable();

        Position memory p = positions[user];
        delete positions[user];

        uint256 penalty = (p.collateral * 5) / 100;
        pool.releaseTo(msg.sender, penalty);
        pool.releaseTo(address(pool), p.collateral - penalty);

        emit PositionLiquidated(user, penalty);
    }
}
