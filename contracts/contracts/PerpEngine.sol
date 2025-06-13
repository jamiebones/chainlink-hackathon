// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { FixedPointMathLib } from "solmate/src/utils/FixedPointMathLib.sol";
import { Utils } from "../lib/Utils.sol";

/// @notice Minimal liquidity pool interface
interface ILiquidityPool {
    function reserve(uint256 amount) external;
    function releaseTo(address to, uint256 amount) external;
    function reserveFrom(address from, uint256 amount) external;
    function totalLiquidity() external view returns (uint256);
    function reservedLiquidity() external view returns (uint256);
    function collectFee(uint256 amount) external;
}

/// @notice Oracle interface fetching on-chain and DEX price feeds
interface IChainLinkManager {
    function getPrice(Utils.Asset asset) external view returns (uint256);       // Oracle price (e.g., Chainlink)
    function getDexPrice(Utils.Asset asset) external view returns (uint256);    // DEX (e.g., Uniswap TWAP)
}

interface IVault {
    function syncFundingPnL(Utils.Asset asset, int256 fundingDelta) external;
    function syncFee(Utils.Asset asset, uint256 feeAmount) external;
}

contract PerpEngine is Ownable, ReentrancyGuard {
    using FixedPointMathLib for uint256;
    using SafeERC20 for IERC20;

    // --- Custom Errors ---
    error InvalidPosition();
    error EmptyPool();
    error ExceedsUtilization();
    error MarketPaused();
    error NoPosition();
    error FeeIsGreaterThanCollateral();
    error invalidPrice();
    error AlreadyOpen();
    error InvalidSizeToReduce();
    error NotLiquidatable();
    error ZeroAmount();
    error PositionUnderCollateralized();

    // --- Configuration Parameters ---
    uint256 public fundingRateSensitivity = 1e16; // 1% deviation = 1%/hr → stored in 1e18 (0.01 * 1e18)
    uint256 public minCollateralRatioBps = 1000;  // 10% minimum margin = 1000 bps
    uint256 public maxUtilizationBps = 8000;      // Max OI utilization = 80% of pool
    uint256 public openFeeBps = 10;               // 0.1%
    uint256 public closeFeeBps = 10;              // 0.1%
    uint256 public liquidationFeeBps = 50;        // 0.5%
    uint256 public borrowingRateAnnualBps = 1000; // 10% = 1000 bps = 10%/year

    bool public isPaused;

    // --- Core Contracts ---
    IERC20 public immutable collateralToken;
    ILiquidityPool public immutable pool;
    IChainLinkManager public immutable chainlinkManager;
    address public protocolAccounting;
    address public vaultAddress;

    // --- Funding Rate State ---
    mapping(Utils.Asset => int256) public cumulativeFundingRate; // 1e18 scaled
    mapping(Utils.Asset => uint256) public lastFundingUpdate;

    // --- Open Interest State ---
    mapping(Utils.Asset => uint256) public longOpenInterestUsd;     // Total $ value of long positions
    mapping(Utils.Asset => uint256) public longOpenInterestTokens;  // Token amount held by longs (usd / price)
    mapping(Utils.Asset => uint256) public shortOpenInterestUsd;    // Total $ value of short positions

    // --- Positions ---
    struct Position {
        uint256 sizeUsd;
        uint256 collateral;
        uint256 entryPrice;
        int256 entryFundingRate;
        bool isLong;
        uint256 lastBorrowingUpdate;  // timestamp
    }

    mapping(address => mapping(Utils.Asset => bytes32)) public vaultHedgePositions;
    uint256 private nextVaultPositionId = 1000000; // Start vault positions at 1M to avoid conflicts

    mapping(address => mapping(Utils.Asset => Position)) public positions;

    // --- Events ---
    event FundingUpdated(Utils.Asset indexed asset, int256 hourlyFundingRate, int256 newCumulativeFundingRate);
    event VaultAddressUpdated(address newVault);
    event ConfigUpdated(uint256 newSensitivity, uint256 newMinCR, uint256 newMaxUtil);
    event FeeUpdated(uint256 openFee, uint256 closeFee, uint256 liquidationFee);
    event PositionOpened(address trader, Utils.Asset asset, uint256 sizeUsd, uint256 collateralAmount, uint256 price, bool isLong);
    event VaultHedgeOpened(address indexed user, Utils.Asset asset, uint256 amount);
    event CollateralAdded(address indexed user, Utils.Asset asset, uint256 newCollateral);
    event SizeIncreased(address indexed user, Utils.Asset asset, uint256 newSizeUsd);
    event PositionReduced(address indexed user, Utils.Asset asset, uint256 reducedSizeUsd, uint256 remainingSizeUsd, int256 pnl);
    event PositionClosed(address indexed user, Utils.Asset asset, uint256 sizeUsd, uint256 netReturn, int256 pnl);
    event CollateralWithdrawn(address indexed user, Utils.Asset indexed asset, uint256 amount, uint256 remainingCollateral);
    event VaultHedgeClosed(address indexed user, Utils.Asset indexed asset, uint256 amount);
    event VaultHedgeIncreased(address indexed vault, Utils.Asset asset, uint256 additionalAmount, uint256 newSize);
    event VaultHedgePartialClose(address indexed vault, Utils.Asset asset, uint256 closeAmount, uint256 actualReturn, int256 pnl);
    event PositionLiquidated(address indexed user, Utils.Asset asset, uint256 positionSize, uint256 penalty);

    modifier onlyVault() {
        require(msg.sender == vaultAddress, "Only vault");
        _;
    }

    // --- Constructor ---
    constructor(address _collateral, address _pool, address _chainlinkManager, address _vaultAddress) Ownable(msg.sender) {
        collateralToken = IERC20(_collateral);
        pool = ILiquidityPool(_pool);
        chainlinkManager = IChainLinkManager(_chainlinkManager);
        vaultAddress = _vaultAddress;
    }

    // --------------------------------------------------------
    // FUNDING RATE LOGIC
    // --------------------------------------------------------

    /// @notice Updates the cumulative funding rate for an asset
    /// @dev Formula:
    ///   fundingRate = (dexPrice - oraclePrice) / oraclePrice * fundingRateSensitivity
    ///   fundingDelta = fundingRate * elapsedSeconds / 3600
    function _updateFundingRate(Utils.Asset asset) internal {
        uint256 nowTime = block.timestamp;
        uint256 last = lastFundingUpdate[asset];
        if (last == 0 || nowTime <= last) {
            lastFundingUpdate[asset] = nowTime;
            return;
        }

        uint256 oraclePrice = chainlinkManager.getPrice(asset);
        uint256 dexPrice = chainlinkManager.getDexPrice(asset);
        if (oraclePrice == 0 || dexPrice == 0) return;

        int256 deviation = int256(dexPrice) - int256(oraclePrice);
        int256 fundingRate = (deviation * int256(fundingRateSensitivity)) / int256(oraclePrice);
        int256 fundingDelta = fundingRate * int256(nowTime - last) / int256(3600);

        cumulativeFundingRate[asset] = cumulativeFundingRate[asset] + fundingDelta;
        lastFundingUpdate[asset] = nowTime;

        emit FundingUpdated(asset, fundingRate, cumulativeFundingRate[asset]);
    }

    /// @dev Applies funding impact to a trader's position
    /// @notice Adjusts collateral based on accrued funding (paid/received)
    /// @param asset The synthetic asset (e.g., TSLA)
    /// @param pos The trader’s position storage reference
    function _applyFunding(Utils.Asset asset, Position storage pos) internal returns (bool applied) {
        if (pos.sizeUsd == 0) return true;

        int256 currentFunding = cumulativeFundingRate[asset];
        int256 entryFunding = pos.entryFundingRate;

        if (currentFunding == entryFunding) return true;

        int256 deltaFundingRate = currentFunding - entryFunding;
        int256 fundingFee = int256(pos.sizeUsd) * deltaFundingRate / int256(1e18);

        if (msg.sender == vaultAddress) {
            applied = _applyFundingToVault(asset, pos, fundingFee);
        } else {
            applied = _applyFundingToTrader(asset, pos, fundingFee);
        }

        if (applied) {
            pos.entryFundingRate = currentFunding;
        }

        return applied;
    }

    function _applyFundingToVault(Utils.Asset asset, Position storage pos, int256 fundingFee) internal returns (bool) {
        if (fundingFee == 0) return true;
        
        if (fundingFee > 0) {
            // Positive funding: longs pay
            if (pos.isLong) {
                if (uint256(fundingFee) < pos.collateral) {
                    pos.collateral -= uint256(fundingFee);
                    IVault(vaultAddress).syncFundingPnL(asset, -fundingFee);
                    return true;
                }
                return false;
            } else {
                // Shorts receive
                pos.collateral += uint256(fundingFee);
                IVault(vaultAddress).syncFundingPnL(asset, fundingFee);
                return true;
            }
        } else {
            // Negative funding: shorts pay, longs receive
            uint256 absFee = uint256(-fundingFee);
            if (pos.isLong) {
                // Longs receive
                pos.collateral += absFee;
                IVault(vaultAddress).syncFundingPnL(asset, -fundingFee);
                return true;
            } else {
                // Shorts pay
                if (absFee < pos.collateral) {
                    pos.collateral -= absFee;
                    IVault(vaultAddress).syncFundingPnL(asset, -fundingFee);
                    return true;
                }
                return false;
            }
        }
    }

    function _applyFundingToTrader(Utils.Asset asset, Position storage pos, int256 fundingFee) internal returns (bool) {
        if (fundingFee == 0) return true;

        uint256 newCollateral;
        
        if (fundingFee > 0) {
            // Positive funding rate (DEX > Oracle)
            if (pos.isLong) {
                // Longs pay funding
                if (uint256(fundingFee) >= pos.collateral) {
                    return false; // FIX #3: Signal that funding wasn't applied
                }
                newCollateral = pos.collateral - uint256(fundingFee);
            } else {
                // Shorts receive funding
                newCollateral = pos.collateral + uint256(fundingFee);
            }
        } else {
            // Negative funding rate (DEX < Oracle)
            uint256 absFee = uint256(-fundingFee);
            if (pos.isLong) {
                // Longs receive funding
                newCollateral = pos.collateral + absFee;
            } else {
                // Shorts pay funding
                if (absFee >= pos.collateral) {
                    return false; // FIX #3: Signal that funding wasn't applied
                }
                newCollateral = pos.collateral - absFee;
            }
        }

        // Check minimum collateral requirement
        uint256 minCollateral = (pos.sizeUsd * minCollateralRatioBps) / 10000;
        if (newCollateral < minCollateral) {
            return false; // Position should be liquidated
        }

        pos.collateral = newCollateral;
        IVault(vaultAddress).syncFundingPnL(asset, fundingFee > 0 ? -fundingFee : fundingFee);
        
        return true;
    }

    function _applyBorrowingFee(Utils.Asset asset, Position storage pos) internal {
        uint256 elapsed = block.timestamp - pos.lastBorrowingUpdate;
        if (elapsed == 0) return;

        // FIX #4: Clear calculation using annual rate
        // fee = positionSize * (annualRate / 365 days) * elapsed
        uint256 fee = pos.sizeUsd * borrowingRateAnnualBps * elapsed / (365 days) / 10000;

        if (fee >= pos.collateral) revert FeeIsGreaterThanCollateral();
        pos.collateral -= fee;

        IVault(vaultAddress).syncFee(asset, fee);
        pos.lastBorrowingUpdate = block.timestamp;
    }


    // --------------------------------------------------------
    // UTILIZATION CHECK
    // --------------------------------------------------------

    /// @notice Validates that the pool is not over-utilized after including this new position
    /// @dev Utilization formula:
    ///   totalProjectedOI = shortOI + (longOI_tokens * oraclePrice)
    ///   utilization = totalProjectedOI / poolLiquidity
    function _validateUtilization(Utils.Asset asset, uint256 newSizeUsd, bool isLong) internal view {
        uint256 totalLiquidity = pool.totalLiquidity();
        if(totalLiquidity == 0) revert EmptyPool();

        uint256 price = chainlinkManager.getPrice(asset);

        uint256 projectedShortOI = shortOpenInterestUsd[asset];
        uint256 projectedLongTokens = longOpenInterestTokens[asset];

        // Estimate projected values post-trade
        if (isLong) {
            projectedLongTokens += (newSizeUsd * 1e18) / price;
        } else {
            projectedShortOI += newSizeUsd;
        }

        uint256 longValuation = (projectedLongTokens * price) / 1e18;
        uint256 totalProjectedOI = projectedShortOI + longValuation;

        uint256 utilizationCap = (totalLiquidity * maxUtilizationBps) / 10000;

        if(totalProjectedOI > utilizationCap) revert ExceedsUtilization();
    }

    /// --- Position Opening ---
    function openPosition(Utils.Asset asset, uint256 collateralAmount, uint256 sizeUsd, bool isLong) public nonReentrant {
        if(collateralAmount == 0 || sizeUsd == 0) revert InvalidPosition();
        if(isPaused) revert MarketPaused();
        if(positions[msg.sender][asset].sizeUsd != 0) revert AlreadyOpen();

        uint256 leverage = sizeUsd.mulDivDown(1e6, collateralAmount);
        require(leverage >= 1e6 && leverage <= 10e6, "Leverage must be 1x to 10x");

        _updateFundingRate(asset);
        _validateUtilization(asset, sizeUsd, isLong);

        // --- Apply open fee ---
        uint256 openFee = (sizeUsd * openFeeBps) / 10000;
        if(collateralAmount < openFee) revert FeeIsGreaterThanCollateral();
        collateralAmount -= openFee;

        collateralToken.safeTransferFrom(msg.sender, address(pool), collateralAmount + openFee);
        pool.collectFee(openFee);
        pool.reserve(sizeUsd);

        uint256 price = chainlinkManager.getPrice(asset);
        if(price == 0) revert invalidPrice();

        positions[msg.sender][asset] = Position({
            sizeUsd: sizeUsd,
            collateral: collateralAmount,
            entryPrice: price,
            entryFundingRate: cumulativeFundingRate[asset],
            isLong: isLong,
            lastBorrowingUpdate: block.timestamp
        });

        if (isLong) {
            longOpenInterestUsd[asset] += sizeUsd;
            longOpenInterestTokens[asset] += (sizeUsd * 1e18) / price;
        } else {
            shortOpenInterestUsd[asset] += sizeUsd;
        }

        emit PositionOpened(msg.sender, asset, sizeUsd, collateralAmount, price, isLong);
    }

    /// @notice Add more collateral to an existing position
    /// @dev No open fees charged here
    function addCollateral(
        Utils.Asset asset,
        uint256 addedCollateral
    ) public nonReentrant {
        Position storage pos = positions[msg.sender][asset];
        if (pos.sizeUsd == 0) revert NoPosition();
        if (isPaused) revert MarketPaused();

        // 1. Sync funding so collateral is up-to-date
        _updateFundingRate(asset);
        if (!_applyFunding(asset, pos)) {
            revert PositionUnderCollateralized();
        }
        _applyBorrowingFee(asset, pos);

        // 2. Pull in new USDC and increase collateral
        collateralToken.safeTransferFrom(msg.sender, address(pool), addedCollateral);
        pos.collateral += addedCollateral;

        emit CollateralAdded(msg.sender, asset, pos.collateral);
    }

    /// @notice Increase the notional size of an existing position
    /// @dev Charges open fee on the *added* size only
    function increasePosition(
        Utils.Asset asset,
        uint256 addedSizeUsd
    ) public nonReentrant {
        Position storage pos = positions[msg.sender][asset];
        if (pos.sizeUsd == 0) revert NoPosition();
        if (isPaused) revert MarketPaused();

        // 1. Bring funding/collateral up-to-date
        _updateFundingRate(asset);
        if (!_applyFunding(asset, pos)) {
            revert PositionUnderCollateralized();
        }
        _applyBorrowingFee(asset, pos);

        // 2. Price fetch
        uint256 price = chainlinkManager.getPrice(asset);

        // 3. Compute fee & resulting collateral (fee is paid from *existing* collateral)
        uint256 fee = (addedSizeUsd * openFeeBps) / 10_000;
        if (fee >= pos.collateral) revert FeeIsGreaterThanCollateral();
        uint256 newSize     = pos.sizeUsd + addedSizeUsd;

        // 4. Pre-check leverage on **net** collateral
        uint256 newLev = newSize.mulDivDown(1e6, pos.collateral);
        require(newLev >= 1e6 && newLev <= 10e6, "Leverage 1x-10x");

        // 5. Utilization check BEFORE touching pool
        _validateUtilization(asset, addedSizeUsd, pos.isLong);

        // 6. External calls (fee transfer + reserve)
        collateralToken.safeTransferFrom(msg.sender, address(pool), fee);
        pool.collectFee(fee);
        pool.reserve(addedSizeUsd);

        // 7. Update position struct
        pos.entryPrice     = (pos.sizeUsd * pos.entryPrice + addedSizeUsd * price) / newSize;
        pos.sizeUsd        = newSize;
        pos.entryFundingRate = cumulativeFundingRate[asset];

        // 8. Update open interest
        if (pos.isLong) {
            longOpenInterestUsd[asset]    += addedSizeUsd;
            longOpenInterestTokens[asset] += (addedSizeUsd * 1e18) / price;
        } else {
            shortOpenInterestUsd[asset]   += addedSizeUsd;
        }

        emit SizeIncreased(msg.sender, asset, newSize);
    }

    function openVaultHedge(Utils.Asset asset, uint256 hedgeAmount) external onlyVault returns (bytes32 positionId) {
        if (hedgeAmount == 0) revert ZeroAmount();
        
        _updateFundingRate(asset);
        
        uint256 price = chainlinkManager.getPrice(asset);
        if (price == 0) revert invalidPrice();

        // Check if vault already has a hedge position for this asset
        Position storage existingPos = positions[msg.sender][asset];
        
        if (existingPos.sizeUsd > 0) {
            // Vault already has hedge - increase existing position
            return _increaseVaultHedge(asset, hedgeAmount, price);
        } else {
            // Create new vault hedge position
            return _createVaultHedge(asset, hedgeAmount, price);
        }
    }

    function _createVaultHedge(Utils.Asset asset, uint256 hedgeAmount, uint256 price) internal returns (bytes32 positionId) {
        // Vault hedges are always 1x long with full collateralization
        // No fees for vault hedge positions
        
        // Transfer hedge collateral from vault
        collateralToken.safeTransferFrom(msg.sender, address(pool), hedgeAmount);
        
        // Reserve liquidity
        pool.reserve(hedgeAmount);
        
        // Create unique position ID for vault hedge
        positionId = bytes32(nextVaultPositionId++);
        
        // Create 1x long hedge position
        positions[msg.sender][asset] = Position({
            sizeUsd: hedgeAmount,
            collateral: hedgeAmount,
            entryPrice: price,
            entryFundingRate: cumulativeFundingRate[asset],
            isLong: true,
            lastBorrowingUpdate: block.timestamp
        });
        
        // Update open interest
        longOpenInterestUsd[asset] += hedgeAmount;
        longOpenInterestTokens[asset] += (hedgeAmount * 1e18) / price;
        
        // Store vault hedge position mapping
        vaultHedgePositions[msg.sender][asset] = positionId;
        
        emit VaultHedgeOpened(msg.sender, asset, hedgeAmount);
        
        return positionId;
    }

    function _increaseVaultHedge(Utils.Asset asset, uint256 additionalAmount, uint256 price) internal returns (bytes32 positionId) {
        Position storage pos = positions[msg.sender][asset];
        
        // Apply funding before modifying position
        if (!_applyFunding(asset, pos)) {
            revert PositionUnderCollateralized();
        }
        _applyBorrowingFee(asset, pos);
        
        // Transfer additional collateral
        collateralToken.safeTransferFrom(msg.sender, address(this), additionalAmount);
        
        // Reserve additional liquidity
        pool.reserve(additionalAmount);
        
        // Update position (weighted average entry price)
        uint256 newSize = pos.sizeUsd + additionalAmount;
        pos.entryPrice = (pos.sizeUsd * pos.entryPrice + additionalAmount * price) / newSize;
        pos.sizeUsd = newSize;
        pos.collateral += additionalAmount;
        pos.entryFundingRate = cumulativeFundingRate[asset];
        
        // Update open interest
        longOpenInterestUsd[asset] += additionalAmount;
        longOpenInterestTokens[asset] += (additionalAmount * 1e18) / price;
        
        positionId = vaultHedgePositions[msg.sender][asset];
        
        emit VaultHedgeIncreased(msg.sender, asset, additionalAmount, newSize);
        
        return positionId;
    }

    /// @notice Withdraw excess collateral from an open position
    /// @param asset  The synthetic asset
    /// @param amount USDC amount to withdraw (6-decimals)
    function withdrawCollateral(
        Utils.Asset asset,
        uint256 amount
    ) public nonReentrant {
        Position storage pos = positions[msg.sender][asset];
        if(isPaused) revert MarketPaused();
        if (pos.sizeUsd == 0) revert NoPosition();
        if (amount == 0) revert InvalidSizeToReduce();

        _updateFundingRate(asset);
        if (!_applyFunding(asset, pos)) {
            revert PositionUnderCollateralized();
        }
        _applyBorrowingFee(asset, pos);

        // Compute required minimum collateral (e.g., 10% margin)
        // minCollateral = pos.sizeUsd * minCollateralRatioBps / 10000
        uint256 minCollateral = pos.sizeUsd
            .mulDivDown(minCollateralRatioBps, 10000);

        // Ensure we don’t withdraw so much that we fall below min margin
        require(pos.collateral >= amount + minCollateral, "Insufficient free collateral");

        // Reduce collateral and release funds from the pool
        pos.collateral -= amount;
        pool.releaseTo(msg.sender, amount);

        emit CollateralWithdrawn(msg.sender, asset, amount, pos.collateral);
    }

    /// @notice Reduce (partially close) an existing position
    function reducePosition(
        Utils.Asset asset,
        uint256 reduceSizeUsd
    ) public nonReentrant returns (uint256 _netReturn, int256 _pnl){
        Position storage pos = positions[msg.sender][asset];
        if (pos.sizeUsd == 0) revert NoPosition();
        if (reduceSizeUsd == 0 || reduceSizeUsd > pos.sizeUsd) revert InvalidSizeToReduce();
        if(isPaused) revert MarketPaused();

        _updateFundingRate(asset);
        _applyFunding(asset, pos);
        _applyBorrowingFee(asset, pos);

        uint256 entry = pos.entryPrice;
        int256 pnl = getPnL(asset, msg.sender);

        uint256 closePortion = (reduceSizeUsd * 1e18) / pos.sizeUsd;
        int256 portionPnL = (pnl * int256(closePortion)) / int256(1e18);
        uint256 proportionalCollateral = (pos.collateral * closePortion) / 1e18;
        
        int256 grossReturn = int256(proportionalCollateral) + portionPnL;
        
        if (grossReturn <= 0) {
            _netReturn = 0;
        } else {
            uint256 gross = uint256(grossReturn);

            uint256 closeFee = 0;
            if (msg.sender != vaultAddress) {
                closeFee = (gross * closeFeeBps) / 10000;
                pool.collectFee(closeFee);
            }
            _netReturn = gross - closeFee;
        }

        pos.sizeUsd -= reduceSizeUsd;
        pos.collateral -= proportionalCollateral;

        if (pos.isLong) {
            longOpenInterestUsd[asset] -= reduceSizeUsd;
            longOpenInterestTokens[asset] -= (reduceSizeUsd * 1e18) / entry;
        } else {
            shortOpenInterestUsd[asset] -= reduceSizeUsd;
        }

        if (_netReturn > 0) {
            pool.releaseTo(msg.sender, _netReturn);
        }

        if (pos.sizeUsd == 0) {
            delete positions[msg.sender][asset];
            if (msg.sender == vaultAddress) {
                delete vaultHedgePositions[msg.sender][asset];
            }
        }

        emit PositionReduced(msg.sender, asset, reduceSizeUsd, pos.sizeUsd, portionPnL);

        return (_netReturn, portionPnL);
    }

    function closePosition(Utils.Asset asset) public {
        if (isPaused) revert MarketPaused();
        Position storage pos = positions[msg.sender][asset];
        if (pos.sizeUsd == 0) revert NoPosition();
        uint256 sizeBefore = pos.sizeUsd;
        (uint256 netReturn, int256 pnl) = reducePosition(asset, sizeBefore);

        emit PositionClosed(msg.sender, asset, sizeBefore, netReturn, pnl);
    }

    function closeVaultHedge(Utils.Asset asset, uint256 redeemAmount) external onlyVault returns (uint256 actualReturn) {
        Position storage pos = positions[msg.sender][asset];
        if (pos.sizeUsd == 0) revert NoPosition();

        if (redeemAmount >= pos.sizeUsd) {
            // Close entire position
            (actualReturn,) = reducePosition(asset, pos.sizeUsd);
        } else {
            // Partial close
            (actualReturn,) = reducePosition(asset, redeemAmount);
        }

        emit VaultHedgeClosed(msg.sender, asset, redeemAmount);
        
        return actualReturn;
    }

    function isLiquidatable(address user, Utils.Asset asset) public view returns (bool) {
        Position memory pos = positions[user][asset];
        if (pos.sizeUsd == 0) return false;
        // Vault Positions should not be liquidated
        if(user == vaultAddress) return false;

        int256 pnl = getPnL(asset, user);

        // Borrowing fee since last interaction
        uint256 timeElapsed = block.timestamp - pos.lastBorrowingUpdate;
        uint256 borrowingFee = pos.sizeUsd * borrowingRateAnnualBps * timeElapsed / (365 days) / 10000;

        int256 netCollateral = int256(pos.collateral) + pnl - int256(borrowingFee);
        if (netCollateral <= 0) return true;

        uint256 ratioBps = uint256(netCollateral) * 10_000 / pos.sizeUsd;
        return ratioBps < minCollateralRatioBps;
    }

    function liquidate(address user, Utils.Asset asset) external nonReentrant {
        Position storage pos = positions[user][asset];
        if (pos.sizeUsd == 0) revert NoPosition();
        if (isPaused) revert MarketPaused();

        _updateFundingRate(asset);
        _applyFunding(asset, pos);
        _applyBorrowingFee(asset, pos);

        if(!isLiquidatable(user, asset)) revert NotLiquidatable();

        uint256 penalty = (pos.collateral * liquidationFeeBps) / 10_000;
        uint256 remaining = pos.collateral > penalty ? pos.collateral - penalty : 0;

        // Store all necessary data before deletion
        uint256 positionSize = pos.sizeUsd;
        uint256 entryPrice = pos.entryPrice;
        bool isLong = pos.isLong;

        // Update open interest first
        if (isLong) {
            longOpenInterestUsd[asset] -= positionSize;
            longOpenInterestTokens[asset] -= (positionSize * 1e18) / entryPrice;
        } else {
            shortOpenInterestUsd[asset] -= positionSize;
        }

        delete positions[user][asset];

        // Now make external calls
        pool.collectFee(penalty);
        pool.releaseTo(msg.sender, penalty);
        if (remaining > 0) {
            pool.releaseTo(address(pool), remaining);
        }

        emit PositionLiquidated(user, asset, positionSize, penalty);
    }

    function _calculatePositionPnL(Position memory pos, uint256 currentPrice) internal pure returns (int256 pnl) {
        if (pos.sizeUsd == 0) return 0;
        
        // For long positions: PnL = sizeUsd * (currentPrice - entryPrice) / entryPrice
        if (pos.isLong) {
            int256 priceDiff = int256(currentPrice) - int256(pos.entryPrice);
            pnl = (int256(pos.sizeUsd) * priceDiff) / int256(pos.entryPrice);
        } else {
            int256 priceDiff = int256(pos.entryPrice) - int256(currentPrice);
            pnl = (int256(pos.sizeUsd) * priceDiff) / int256(pos.entryPrice);
        }
        
        return pnl;
    }

    // --------------------------------------------------
    // VIEW / UTILITY GETTERS
    // --------------------------------------------------

    /// Returns unrealized PnL for a user’s position
    function getPnL(Utils.Asset asset, address user) public view returns (int256) {
        Position memory pos = positions[user][asset];
        if (pos.sizeUsd == 0) return 0;
        uint256 price = chainlinkManager.getPrice(asset);
        uint256 val = pos.sizeUsd.mulDivDown(price, pos.entryPrice);
           
        return pos.isLong
            ? int256(val) - int256(pos.sizeUsd)
            : int256(pos.sizeUsd) - int256(val);
    }

    /// Returns current collateral ratio in bps (collateral+PnL) / sizeUsd * 10000
    function getCollateralRatio(address user, Utils.Asset asset) external view returns (uint256) {
        Position memory pos = positions[user][asset];
        if (pos.sizeUsd == 0) return 0;
        int256 pnl = getPnL(asset, user);
        int256 net = int256(pos.collateral) + pnl;
        if (net <= 0) return 0;
        return uint256(net) * 10000 / pos.sizeUsd;
    }

    function getVaultHedgeValue(Utils.Asset asset) external view returns (int256 hedgeValue) {
        Position memory pos = positions[vaultAddress][asset];
        if (pos.sizeUsd == 0) return 0;
        
        return getPnL(asset, vaultAddress);
    }

    /// Get full position details for a user+asset
    function getPosition(address user, Utils.Asset asset) external view returns (
        uint256 sizeUsd,
        uint256 collateral,
        uint256 entryPrice,
        int256 entryFundingRate,
        bool isLong
    ) {
        Position memory p = positions[user][asset];
        return (
            p.sizeUsd,
            p.collateral,
            p.entryPrice,
            p.entryFundingRate,
            p.isLong
        );
    }

    ///  Get detailed vault hedge position info
    function getVaultHedgePosition(Utils.Asset asset) external view returns (
        uint256 sizeUsd,
        uint256 collateral,
        uint256 entryPrice,
        int256 currentPnL,
        uint256 currentValue,
        bool exists
    ) {
        Position memory pos = positions[vaultAddress][asset];
        
        if (pos.sizeUsd == 0) {
            return (0, 0, 0, 0, 0, false);
        }
        
        currentPnL = getPnL(asset, vaultAddress);
        
        int256 grossValue = int256(pos.collateral) + currentPnL;
        currentValue = grossValue > 0 ? uint256(grossValue) : 0;
        
        return (
            pos.sizeUsd,
            pos.collateral,
            pos.entryPrice,
            currentPnL,
            currentValue,
            true
        );
    }

    function getVaultHedgePnL(Utils.Asset asset) external view returns (int256 pnl) {
        Position memory pos = positions[vaultAddress][asset];
        if (pos.sizeUsd == 0) return 0;
        
        uint256 currentPrice = chainlinkManager.getPrice(asset);
        return _calculatePositionPnL(pos, currentPrice);
    }

    /// Check if vault has hedge position for asset
    function hasVaultHedge(Utils.Asset asset) external view returns (bool) {
        return positions[vaultAddress][asset].sizeUsd > 0;
    }

    /// Get pool utilization in bps
    function getPoolUtilization() external view returns (uint256) {
        uint256 total = pool.totalLiquidity();
        if (total == 0) return 0;
        return pool.reservedLiquidity().mulDivDown(10000, total);
    }

    function getFundingRate(Utils.Asset asset) external view returns (int256) {
        return cumulativeFundingRate[asset];
    }

    /// Get open interest (long and short) in USD
    function getOpenInterest(Utils.Asset asset) external view returns (uint256 longUsd, uint256 shortUsd) {
        longUsd = longOpenInterestUsd[asset];
        shortUsd = shortOpenInterestUsd[asset];
    }

    /// Get long open interest in token units
    function getLongOI(Utils.Asset asset) external view returns (uint256) {
        return longOpenInterestTokens[asset];
    }

    /// Get current leverage for a user position (1e6 = 1x)
    function getLeverage(address user, Utils.Asset asset) external view returns (uint256) {
        Position memory p = positions[user][asset];
        if (p.sizeUsd == 0) return 0;
        return p.sizeUsd.mulDivDown(1e6, p.collateral);
    }

    /// Get liquidation price where collateral ratio hits the minimum
    function getLiquidationPrice(address user, Utils.Asset asset) external view returns (uint256) {
        Position memory p = positions[user][asset];
        if (p.sizeUsd == 0) return 0;
        uint256 minColl = p.sizeUsd.mulDivDown(minCollateralRatioBps, 10000);
        // For longs: L = entryPrice * (1 + (minColl - collateral)/sizeUsd)
        int256 num = int256(minColl) - int256(p.collateral);
        int256 factor = int256(1e18) + (num * int256(1e18) / int256(p.sizeUsd));
        return uint256(factor) * p.entryPrice / 1e18;
    }

    //added this to be able to call from the vault
    function addFeesToPool(uint256 feeAmount) external onlyVault {
        if (feeAmount == 0) revert ZeroAmount();
        pool.collectFee(feeAmount);
    }

    // --------------------------------------------------------
    // ADMIN CONFIGURATION
    // --------------------------------------------------------

    function setConfig(uint256 sensitivity, uint256 minCR, uint256 maxUtil) external onlyOwner {
        fundingRateSensitivity = sensitivity;
        minCollateralRatioBps = minCR;
        maxUtilizationBps = maxUtil;
        emit ConfigUpdated(sensitivity, minCR, maxUtil);
    }

    function setVaultAddress(address _vaultAddress) external onlyOwner {
        vaultAddress = _vaultAddress;
        emit VaultAddressUpdated(_vaultAddress);
    }

    function setBorrowingRateAnnualBps(uint256 _borrowingRateAnnualBps) external onlyOwner {
        borrowingRateAnnualBps = _borrowingRateAnnualBps;
    }

    function setFees(uint256 _open, uint256 _close, uint256 _liq) external onlyOwner {
        openFeeBps = _open;
        closeFeeBps = _close;
        liquidationFeeBps = _liq;
        emit FeeUpdated(_open, _close, _liq);
    }

    function pause() external onlyOwner {
        isPaused = true;
    }

    function unpause() external onlyOwner {
        isPaused = false;
    }

    // Emergency function to close vault hedge (admin only)
    function emergencyCloseVaultHedge(Utils.Asset asset) external onlyOwner returns (uint256 actualReturn) {
        Position storage pos = positions[vaultAddress][asset];
        if (pos.sizeUsd == 0) revert NoPosition();

        // Store the size before clearing
        uint256 positionSize = pos.sizeUsd;
        
        // Directly handle the emergency close without going through reducePosition
        // since reducePosition expects msg.sender to be the position owner
        _updateFundingRate(asset);
        _applyFunding(asset, pos);
        _applyBorrowingFee(asset, pos);

        uint256 collateral = pos.collateral;
        uint256 entryPrice = pos.entryPrice;
        
        // Update open interest
        longOpenInterestUsd[asset] -= positionSize;
        longOpenInterestTokens[asset] -= (positionSize * 1e18) / entryPrice;
        
        // Clear the position
        delete positions[vaultAddress][asset];
        delete vaultHedgePositions[vaultAddress][asset];
        
        // Release funds
        pool.releaseTo(vaultAddress, collateral);
        
        emit VaultHedgeClosed(vaultAddress, asset, positionSize);
        
        return collateral;
    }
}
