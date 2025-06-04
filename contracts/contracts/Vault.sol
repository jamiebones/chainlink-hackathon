// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ChainlinkManager} from "./ChainlinkManager.sol";
import {Utils} from "../lib/Utils.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {IAsset} from "../interfaces/IAsset.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract Vault is ReentrancyGuard {
    address public admin;
    uint256 public totalBufferCollateralBalance;
    uint256 public totalHedgedCollateralBalance;

    uint256 public constant PRECISION = 1e18; //18 decimals
    uint256 public constant USDC_PRECISION = 1e6; //6 decimals
    uint256 public constant CHAINLINK_PRECISION = 1e8; //8 decimals
    uint256 public constant PERCENTAGE_COLLATERAL = 110 * 1e16; //18 decimals

    ChainlinkManager public chainlinkManager;
    IERC20 private usdcContract;
    IAsset private sTSLA;
    IAsset private sAPPL;

    struct SyntheticSlot {
        address trader;
        uint256 mintedAmount; //18 decimals
        uint256 bufferCollateral; //in USDC, 6 decimals
        uint256 hedgedCollateral; //in USDC, 6 decimals
        uint256 entryPrice; //18 decimals
        uint256 timestamp;
        Utils.Asset assetType;
        bool paidOut; //tracks if the buffer collateral has been paid out to the trader
        bool isActive; //tracks if the position is active
    }

    //structs

    mapping(address => mapping(uint256 => SyntheticSlot)) public userPositions;
    mapping(address => uint256) public userPositionCount;

    bool public isPaused;
    bool public isStarted;

    //errors

    error NotAdmin();

    //pause protocol

    modifier onlyAdmin() {
        if (msg.sender != admin) revert NotAdmin();
        _;
    }

    //events
    event PositionCreated(
        address indexed trader,
        uint256 mintedAmount,
        uint256 bufferCollateral,
        uint256 hedgedCollateral,
        uint256 entryPrice,
        uint256 indexed positionId,
        uint256 date,
        Utils.Asset assetType
    );
    event PositionClosed(
        address indexed trader,
        uint256 indexed positionId,
        Utils.Asset assetType,
        uint256 mintedAmount,
        uint256 bufferCollateral,
        uint256 hedgedCollateral,
        uint256 entryPrice
    );

    error NotStarted();
    error AlreadyStarted();
    error Paused();
    error InvalidAssetTypeUsed();
    error InvalidPrice();
    error TransferofFundsFailed();

    constructor(address _usdc, address _admin, address _chainlinkManager) {
        chainlinkManager = ChainlinkManager(_chainlinkManager);
        usdcContract = IERC20(_usdc);
        admin = _admin;
    }

    function startUpProtocol(
        address _sTSLA,
        address _sAPPL
    ) external onlyAdmin {
        if (isStarted) revert AlreadyStarted();
        isStarted = true;
        sTSLA = IAsset(_sTSLA);
        sAPPL = IAsset(_sAPPL);
    }

    function openPosition(
        Utils.Asset assetType,
        uint256 numofShares
    ) external nonReentrant {
        //numofShares comes from the frontend as 18 decimals
        if (!isStarted) revert NotStarted();
        if (isPaused) revert Paused();

        if (assetType != Utils.Asset.TSLA && assetType != Utils.Asset.APPL) {
            revert InvalidAssetTypeUsed();
        }

        // Initialize assetContract safely
        IAsset assetContract = assetType == Utils.Asset.TSLA ? sTSLA : sAPPL;

        uint256 chainLinkEntryPrice = getScaledChainlinkPrice(assetType);
        uint256 dexEntryPrice = getScaledDexPrice(assetType);
        uint256 mintFeePercentage = _calculateMintFee(
            dexEntryPrice,
            chainLinkEntryPrice
        );

        uint256 amountForSharesInUSD = (chainLinkEntryPrice * numofShares) /
            PRECISION;
        uint256 collacteralForSharesInUSD = (amountForSharesInUSD *
            PERCENTAGE_COLLATERAL) / PRECISION;
        uint256 mintFee = (mintFeePercentage * collacteralForSharesInUSD) /
            PRECISION;

        uint256 totalcollacteralINUSD = mintFee + collacteralForSharesInUSD;
        uint256 totalCollacteralInUSDCToPay = convert18ToUSDCDecimal(
            totalcollacteralINUSD
        );

        uint256 bufferCollacteral = totalcollacteralINUSD / 10;
        uint256 hedgeCollacteral = totalcollacteralINUSD -
            (totalcollacteralINUSD / 10);

        //increment the hedge and buffer balances
        totalBufferCollateralBalance += totalcollacteralINUSD / 10;
        totalHedgedCollateralBalance += hedgeCollacteral;
        //build and save the new vault

        SyntheticSlot memory newVault = SyntheticSlot({
            trader: msg.sender,
            mintedAmount: numofShares,
            bufferCollateral: bufferCollacteral,
            hedgedCollateral: hedgeCollacteral,
            entryPrice: chainLinkEntryPrice,
            assetType: assetType,
            paidOut: false,
            isActive: true,
            timestamp: block.timestamp
        });

        uint256 newIndex = userPositionCount[msg.sender];
        userPositions[msg.sender][newIndex] = newVault;
        userPositionCount[msg.sender]++;

        //mint the tokens and send the user
        assetContract.mint(msg.sender, numofShares);
        (bool success, bytes memory data) = address(usdcContract).call(
            abi.encodeWithSelector(
                usdcContract.transferFrom.selector,
                msg.sender,
                address(this),
                totalCollacteralInUSDCToPay
            )
        );
        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
            revert TransferofFundsFailed();
        }
        //collect the money
        //revert if the collection of the money was not succesful
        if (!success) revert TransferofFundsFailed();

        //deposit the money in the in house pool
        //usdcContract.transfer(hedgeCollacteral, address(0)) //sample deposit to the inhouse perps protocol
        emit PositionCreated({
            trader: msg.sender,
            positionId: newIndex,
            assetType: assetType,
            mintedAmount: numofShares,
            bufferCollateral: bufferCollacteral,
            hedgedCollateral: hedgeCollacteral,
            entryPrice: chainLinkEntryPrice,
            date: block.timestamp
        });
    }

    function pause() external onlyAdmin {
        isPaused = true;
    }

    function unpause() external onlyAdmin {
        isPaused = false;
    }

    function _calculateMintFee(
        uint256 dexPrice,
        uint256 oraclePrice
    ) public pure returns (uint256) {
        // All values are scaled by 1e18 (18 decimals)
        uint256 BASE_FEE = 5e15; // 0.005 * 1e18 = 0.5%
        uint256 MAX_FEE = 5e16; // 0.05 * 1e18 = 5%
        uint256 MIN_FEE = 2e15; // 0.002 * 1e18 = 0.2%
        uint256 RELAXED_ZONE = 3e16; // 0.03 * 1e18 = 3%
        uint256 MAX_DEV = 2e16; // 0.02 * 1e18 = 2%

        // Calculate deviation: (dexPrice - oraclePrice) / oraclePrice
        int256 deviation = int256(dexPrice) - int256(oraclePrice);
        deviation = (deviation * int256(1e18)) / int256(oraclePrice); // deviation in 1e18

        int256 absDeviation = deviation >= 0 ? deviation : -deviation;

        // Case 1: Within relaxed zone
        if (uint256(absDeviation) <= RELAXED_ZONE) {
            return BASE_FEE;
        }

        // Case 2: sTSLA is undervalued (deviation < -relaxedZone)
        if (deviation < -int256(RELAXED_ZONE)) {
            // adjustedDev = min(abs(deviation) - relaxedZone, 0.02)
            uint256 adjustedDev = uint256(absDeviation) - RELAXED_ZONE;
            if (adjustedDev > MAX_DEV) adjustedDev = MAX_DEV;
            // fee = baseFee + (adjustedDev / 0.02) * (maxFee - baseFee)
            // (adjustedDev * 1e18) / 0.02e18 = adjustedDev * 1e18 / 2e16 = adjustedDev * 50
            uint256 fee = BASE_FEE +
                (adjustedDev * (MAX_FEE - BASE_FEE)) /
                MAX_DEV;
            return fee > MAX_FEE ? MAX_FEE : fee;
        }

        // Case 3: sTSLA is overvalued (deviation > relaxedZone)
        if (deviation > int256(RELAXED_ZONE)) {
            uint256 adjustedDev = uint256(deviation) - RELAXED_ZONE;
            if (adjustedDev > MAX_DEV) adjustedDev = MAX_DEV;
            // fee = baseFee - (adjustedDev / 0.02) * (baseFee - minFee)
            uint256 fee = BASE_FEE -
                (adjustedDev * (BASE_FEE - MIN_FEE)) /
                MAX_DEV;
            return fee < MIN_FEE ? MIN_FEE : fee;
        }

        // Fallback (should not reach here)
        return BASE_FEE;
    }

    function getScaledChainlinkPrice(
        Utils.Asset asset
    ) public view returns (uint256) {
        uint256 price = chainlinkManager.getPrice(asset);
        require(price > 0, "Invalid price");
        return uint256(price) * (PRECISION / CHAINLINK_PRECISION);
    }

    function getScaledDexPrice(
        Utils.Asset asset
    ) public view returns (uint256) {
        uint256 price = chainlinkManager.getDexPriceofAsset(asset);
        require(price > 0, "Invalid price");
        return uint256(price) * (PRECISION / CHAINLINK_PRECISION);
    }

    function convert18ToUSDCDecimal(
        uint256 value18
    ) public pure returns (uint256) {
        return value18 / 1e12;
    }
}
