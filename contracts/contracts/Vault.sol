// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ChainlinkManager} from "./ChainlinkManager.sol";
import {Utils} from "../lib/Utils.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {IAsset} from "../interfaces/IAsset.sol";
import {PerpEngine} from "./PerpEngine.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract Vault is ReentrancyGuard {
    address public admin;
    address public perpEngine; //address of the perp engine contract
    // uint256 public totalBufferCollateralBalance;
    // uint256 public totalHedgedCollateralBalance;
    uint256 public constant PRECISION = 1e18; //18 decimals
    uint256 public constant USDC_PRECISION = 1e6; //6 decimals
    uint256 public constant CHAINLINK_PRECISION = 1e8; //8 decimals
    uint256 public constant PERCENTAGE_COLLATERAL = 110 * 1e16; //18 decimals

    bool public isStarted;

    ChainlinkManager public chainlinkManager;
    PerpEngine public perpEngineContract;
    IERC20 private usdcContract;
    IAsset private sTSLA;
    IAsset private sAPPL;

    struct SyntheticSlot {
        address trader;
        uint256 mintedAmount; //18 decimals
        uint256 bufferCollateral; //in USDC, 6 decimals
        uint256 hedgedCollateral; //in USDC, 6 decimals
        uint256 entryPrice; //18 decimals
        uint256 positionIndex;
        uint256 timestamp;
        Utils.Asset assetType;
        bool paidOut; //tracks if the buffer collateral has been paid out to the trader
        bool isActive; //tracks if the position is active
    }

    //structs

    mapping(address => mapping(uint256 => SyntheticSlot)) public userPositions;
    mapping(address => uint256) public userPositionCount;

    mapping(Utils.Asset => uint256) public totalUserBufferUSDC; //tracks the total buffer collateral for each asset type
    mapping(Utils.Asset => uint256) public globalBufferUSDC; //tracks the total USDC buffer held by protocol (10% from every user)
    mapping(Utils.Asset => uint256) public totalVaultDebt; //Total sTSLA minted by all users (denotes protocol's synthetic liability)
    //mapping => address => utils.Asset => uint256

    //errors
    error NotAdmin();
    error InsufficientTokenAmountSpecified();
    error NotStarted();
    error AlreadyStarted();
    error Paused();
    error InvalidAssetTypeUsed();
    error InvalidPrice();
    error TransferofFundsFailed();
    error InsufficientFundForPayout();
    error InvalidVaultID();
    error VaultAlreadyPaidOut();
    error MarketNotOpen();
    error CircuitBreakerActivatedForAsset(Utils.Asset);
    error StocksToReddemLowerThanUserBalance();
    error NotPerpEngine();
    error InvalidNumberOfShares();
    error InvalidAmount();
    error DivisionByZero();
    error InsufficientVaultDebt();
    error PossibleAccountingErrorOne();
    error PossibleAccountingErrorTwo();
    error PossibleAccountingErrorThree();
    error InSufficientGlobalBufferAmount();
    event PerpEngineUpdated(address newPerp);

    //pause protocol

    modifier onlyAdmin() {
        if (msg.sender != admin) revert NotAdmin();
        _;
    }

    modifier onlyPerpEngine() {
        if (msg.sender != perpEngine) revert NotPerpEngine();
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
        uint256 burnedAmount,
        uint256 amountRefunded,
        uint256 redemtionFee,
        uint256 date,
        Utils.Asset assetType
    );

    event FundingSettled(Utils.Asset indexed asset, int256 delta, uint256 date);
    event MintFeeCollected(address indexed user, uint256 amountUSDC);
    event RedemptionFeeCollected(address indexed user, uint256 amountUSDC);


    constructor(address _usdc, address _admin, address _chainlinkManager) {
        chainlinkManager = ChainlinkManager(_chainlinkManager);
        usdcContract = IERC20(_usdc);
        admin = _admin;
    }

    function startUpProtocol(
        address _sTSLA,
        address _sAPPL,
        address _perpEngine
    ) external onlyAdmin {
        if (isStarted) revert AlreadyStarted();
        isStarted = true;
        sTSLA = IAsset(_sTSLA);
        sAPPL = IAsset(_sAPPL);
        perpEngineContract = PerpEngine(_perpEngine);
    }

    function openPosition(
        Utils.Asset assetType,
        uint256 numofShares //comes in as 18 decimals from the frontend
    ) external nonReentrant {
        if (numofShares == 0) revert InvalidNumberOfShares();
        //numofShares comes from the frontend as 18 decimals
        _checkPriceAndMarketStatus(assetType);

        // Initialize assetContract safely
        IAsset assetContract = assetType == Utils.Asset.TSLA ? sTSLA : sAPPL;

        // Comment out price checks temporarily

        uint256 chainLinkEntryPrice = getScaledChainlinkPrice(assetType);
        uint256 twapPrice = getScaledTwapPrice(assetType);

        uint256 mintFeePercentage = _calculateMintFee(
            twapPrice,
            chainLinkEntryPrice
        );

        uint256 notionalUSD18 = (chainLinkEntryPrice * numofShares) / PRECISION;
        uint256 notionalUSDC  = convert18ToUSDCDecimal(notionalUSD18);
        uint256 collateralUSDC = (notionalUSDC * 110) / 100;
        uint256 bufferCollateral = notionalUSDC / 10; 
        uint256 hedgeCollateral  = collateralUSDC - bufferCollateral; 
        uint256 mintFeeUSDC = convert18ToUSDCDecimal(
            (mintFeePercentage * notionalUSD18) / PRECISION
        );
        uint256 totalToCollectUSDC = collateralUSDC + mintFeeUSDC;

        //increment user buffer collateral and vault debt
        totalUserBufferUSDC[assetType] += bufferCollateral;
        totalVaultDebt[assetType] += numofShares;
        globalBufferUSDC[assetType] += bufferCollateral;

        //build and save the new vault
        uint256 newIndex = userPositionCount[msg.sender];

        SyntheticSlot memory newVault = SyntheticSlot({
            trader: msg.sender,
            mintedAmount: numofShares,
            bufferCollateral: bufferCollateral,
            hedgedCollateral: hedgeCollateral,
            entryPrice: chainLinkEntryPrice,
            assetType: assetType,
            positionIndex: newIndex,
            paidOut: false,
            isActive: true,
            timestamp: block.timestamp
        });

        userPositions[msg.sender][newIndex] = newVault;
        userPositionCount[msg.sender]++;

        // First check USDC balance and transfer
        if (
            usdcContract.balanceOf(msg.sender) <
            totalToCollectUSDC
        ) {
            revert InsufficientFundForPayout();
        }
        (bool success, bytes memory data) = address(usdcContract).call(
            abi.encodeWithSelector(
                usdcContract.transferFrom.selector,
                msg.sender,
                address(this),
                totalToCollectUSDC
            )
        );

        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
            revert TransferofFundsFailed();
        }

        // Then mint the tokens and send to user
        assetContract.mint(msg.sender, numofShares);

        //hedge is in 6 decimal place
        perpEngineContract.openVaultHedge(assetType, hedgeCollateral);
        perpEngineContract.addFeesToPool(mintFeeUSDC);
        emit MintFeeCollected(msg.sender, mintFeeUSDC);
        emit PositionCreated({
            trader: msg.sender,
            positionId: newIndex,
            assetType: assetType,
            mintedAmount: numofShares,
            bufferCollateral: bufferCollateral,
            hedgedCollateral: hedgeCollateral,
            entryPrice: chainLinkEntryPrice,
            date: block.timestamp
        });
    }

    function redeemStock(
        Utils.Asset assetType,
        uint256 stockToRedeem
    ) external nonReentrant {
        if (!isStarted) revert NotStarted();

        _checkPriceAndMarketStatus(assetType);

        uint256 amountOfSharesInUSDC = _calculateUserAssetRedemption(
            assetType,
            stockToRedeem
        );

        uint256 currentChainlinkAssetPrice = getScaledChainlinkPrice(assetType);
        uint256 currentDexAssetPrice = getScaledTwapPrice(assetType);
        uint256 redemptionPercentage = _calculateRedeemFee(
            currentChainlinkAssetPrice,
            currentDexAssetPrice
        );

        uint256 redemptionFee = (amountOfSharesInUSDC * redemptionPercentage) /
            PRECISION;

        // Ensure redemptionFee does not exceed amountOfSharesInUSDC
        require(
            redemptionFee <= amountOfSharesInUSDC,
            "Redemption fee exceeds redemption amount"
        );

        uint256 amountToPayUser;
        if (amountOfSharesInUSDC > redemptionFee) {
            amountToPayUser = amountOfSharesInUSDC - redemptionFee;
        } else {
            // If fee is larger than amount, set amount to 0 and fee to full amount
            redemptionFee = amountOfSharesInUSDC;
            amountToPayUser = 0;
        }

        // Check if the contract has enough USDC to pay the user
        uint256 vaultUSDCBalance = usdcContract.balanceOf(address(this));
        if (vaultUSDCBalance < amountToPayUser) {
            revert InsufficientFundForPayout();
        }

        // Transfer USDC to the user
        (bool success, bytes memory data) = address(usdcContract).call(
            abi.encodeWithSelector(
                usdcContract.transfer.selector,
                msg.sender,
                amountToPayUser
            )
        );
        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
            revert TransferofFundsFailed();
        }

        // Add the redemption fee to the PerpEngine pool
        try perpEngineContract.addFeesToPool(redemptionFee) {
            // Fee successfully added to the PerpEngine pool
        } catch {
            revert("Failed to add fees to PerpEngine pool");
        }
        emit RedemptionFeeCollected(msg.sender, redemptionFee);
        emit PositionClosed({
            trader: msg.sender,
            assetType: assetType,
            burnedAmount: stockToRedeem,
            redemtionFee: redemptionFee,
            amountRefunded: amountToPayUser,
            date: block.timestamp
        });

    }

    function redeemVault(uint256 vaultID, uint256 portionToRedeem) external {
        //check if the vault is present and has not been redeemed already
        if (!isStarted) revert NotStarted();
        if (vaultID >= userPositionCount[msg.sender]) {
            revert InvalidVaultID();
        }
     
        if (portionToRedeem == 0) revert InsufficientTokenAmountSpecified();

        SyntheticSlot storage vault = userPositions[msg.sender][vaultID];
        if (vault.trader == address(0)) {
            revert InvalidVaultID();
        }
        if (vault.mintedAmount == 0) {
            revert VaultAlreadyPaidOut();
        }
        if (vault.paidOut) {
            revert VaultAlreadyPaidOut();
        }
        require(
            portionToRedeem <= vault.mintedAmount,
            "Redeem amount exceeds minted amount"
        );
        IAsset assetContract = vault.assetType == Utils.Asset.TSLA
            ? sTSLA
            : sAPPL;
        uint256 traderBalanceofAsset = assetContract.balanceOf(msg.sender);
        uint256 userShareBuffer = _processAssetBufferPayment(
            vault,
            portionToRedeem
        );

        bool onlyVaultWithdrawal = (traderBalanceofAsset < portionToRedeem);
        uint256 userAssetRedemption = 0;

        if (!onlyVaultWithdrawal) {
            userAssetRedemption = _calculateUserAssetRedemption(
                userPositions[msg.sender][vaultID].assetType,
                portionToRedeem
            );
        }

        //calculate the curent price of the stock
        uint256 currentChainlinkAssetPrice = getScaledChainlinkPrice(
            vault.assetType
        );
        uint256 currentDexAssetPrice = getScaledTwapPrice(vault.assetType);
        uint256 redemptionPercentage = _calculateRedeemFee(
            currentChainlinkAssetPrice,
            currentDexAssetPrice
        );

        uint256 redemtionFee = ((userAssetRedemption + userShareBuffer) *
            redemptionPercentage) / PRECISION;

    
        uint256 totalAmount = userAssetRedemption + userShareBuffer;
        uint256 amountToPayUser;
        if (totalAmount > redemtionFee) {
            amountToPayUser = totalAmount - redemtionFee;
        } else {
            redemtionFee = totalAmount;
            amountToPayUser = 0;
        }

        (bool success, bytes memory data) = address(usdcContract).call(
            abi.encodeWithSelector(
                usdcContract.transfer.selector,
                msg.sender,
                amountToPayUser
            )
        );
        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
            revert TransferofFundsFailed();
        }

        //add the fee to the perp engine
        perpEngineContract.addFeesToPool(redemtionFee);
        emit RedemptionFeeCollected(msg.sender, redemtionFee);
        emit PositionClosed({
            trader: msg.sender,
            assetType: vault.assetType,
            burnedAmount: userAssetRedemption,
            redemtionFee: redemtionFee,
            amountRefunded: amountToPayUser,
            date: block.timestamp
        });
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
        if (asset != Utils.Asset.TSLA && asset != Utils.Asset.APPL) {
            revert InvalidAssetTypeUsed();
        }
        uint256 price = chainlinkManager.getPrice(asset);
        require(price > 0, "Invalid price");
        return uint256(price) * (PRECISION / CHAINLINK_PRECISION);
    }

    function getScaledTwapPrice(
        Utils.Asset asset
    ) public view returns (uint256) {
        if (asset != Utils.Asset.TSLA && asset != Utils.Asset.APPL) {
            revert InvalidAssetTypeUsed();
        }
        uint256 price = chainlinkManager.getTwapPriceofAsset(asset);
        require(price > 0, "Invalid price");
        return uint256(price) * (PRECISION / CHAINLINK_PRECISION);
    }

    function convert18ToUSDCDecimal(
        uint256 value18
    ) public pure returns (uint256) {
        if (value18 == 0) revert InvalidAmount();
        return value18 / 1e12;
    }

    function _calculateRedeemFee(
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
        // Case 1: Within relaxed zone → use base fee
        if (uint256(absDeviation) <= RELAXED_ZONE) {
            return BASE_FEE;
        }

        // Case 2: sTSLA is overvalued → discourage redemption (increase fee)
        if (deviation > int256(RELAXED_ZONE)) {
            uint256 adjustedDev = uint256(deviation) - RELAXED_ZONE;
            if (adjustedDev > MAX_DEV) adjustedDev = MAX_DEV;
            uint256 fee = BASE_FEE +
                (adjustedDev * (MAX_FEE - BASE_FEE)) /
                MAX_DEV;
            return fee > MAX_FEE ? MAX_FEE : fee;
        }

        // Case 3: sTSLA is undervalued → encourage redemption (decrease fee)
        if (deviation < -int256(RELAXED_ZONE)) {
            uint256 adjustedDev = uint256(absDeviation) - RELAXED_ZONE;
            if (adjustedDev > MAX_DEV) adjustedDev = MAX_DEV;
            uint256 fee = BASE_FEE -
                (adjustedDev * (BASE_FEE - MIN_FEE)) /
                MAX_DEV;
            return fee < MIN_FEE ? MIN_FEE : fee;
        }

        // Fallback (should not reach here)
        return BASE_FEE;
    }

    function emergencyWithdraw(address token) external onlyAdmin {
        IERC20 tokenContract = IERC20(token);
        uint256 balance = tokenContract.balanceOf(address(this));
        tokenContract.transfer(admin, balance);
    }

    function _checkPriceAndMarketStatus(Utils.Asset asset) internal view {
        // Check if market is open
        if (!isStarted) revert NotStarted();
        if (!chainlinkManager.isMarketOpen()) revert MarketNotOpen();

        // Check if asset is paused
        if (chainlinkManager.checkIfAssetIsPaused(asset))
            revert CircuitBreakerActivatedForAsset(asset);

        // Validate asset type
        if (asset != Utils.Asset.TSLA && asset != Utils.Asset.APPL)
            revert InvalidAssetTypeUsed();
    }

    function _processAssetBufferPayment(
        SyntheticSlot storage vault,
        uint256 tokenToRedeem
    ) private returns (uint256) {
        // Validate input
        if (tokenToRedeem == 0 || tokenToRedeem > vault.mintedAmount)
            revert InvalidAmount();

        // Calculate redemption ratio using token amounts directly
        uint256 redemptionRatio = (tokenToRedeem * PRECISION) /
            vault.mintedAmount;

        // Calculate shares using ratio method
        uint256 userOriginalBufferShare = (vault.bufferCollateral *
            redemptionRatio) / PRECISION;
        uint256 userHedgedShare = (vault.hedgedCollateral * redemptionRatio) /
            PRECISION;

        // Update vault state
        if(vault.bufferCollateral < userOriginalBufferShare) {
            revert PossibleAccountingErrorOne(); 
        }
        if(vault.mintedAmount < tokenToRedeem) {
            revert PossibleAccountingErrorTwo(); 
        }
        if(vault.hedgedCollateral < userHedgedShare) {
            revert PossibleAccountingErrorThree(); 
        }
        vault.mintedAmount -= tokenToRedeem;
        vault.bufferCollateral -= userOriginalBufferShare;
        vault.hedgedCollateral -= userHedgedShare;

        // Handle full redemption
        if (vault.mintedAmount == 0) {
            vault.paidOut = true;
            vault.isActive = false;
        }

        // Check global buffer state
        if (totalUserBufferUSDC[vault.assetType] == 0) revert DivisionByZero();

        // Calculate user's buffer share using safe math
        uint256 userBuferShare = (userOriginalBufferShare *
            globalBufferUSDC[vault.assetType]) /
            totalUserBufferUSDC[vault.assetType];

        // Ensure we don't underflow global balances
        if (globalBufferUSDC[vault.assetType] < userBuferShare) {
            userBuferShare = globalBufferUSDC[vault.assetType];
        }
        if (totalUserBufferUSDC[vault.assetType] < userOriginalBufferShare) {
            userOriginalBufferShare = totalUserBufferUSDC[vault.assetType];
        }

        // Update global state
        globalBufferUSDC[vault.assetType] -= userBuferShare;
        totalUserBufferUSDC[vault.assetType] -= userOriginalBufferShare;

        return userBuferShare;
}


    function _calculateUserAssetRedemption(
        Utils.Asset assetType,
        uint256 stockToRedeem
    ) private returns (uint256) {
        if (stockToRedeem == 0) revert InsufficientTokenAmountSpecified();

        // Initialize assetContract safely
        IAsset assetContract = assetType == Utils.Asset.TSLA ? sTSLA : sAPPL;
        uint256 traderBalanceofAsset = assetContract.balanceOf(msg.sender);

        if (traderBalanceofAsset < stockToRedeem) {
            revert StocksToReddemLowerThanUserBalance();
        }
        //reduce the vault debt 
        totalVaultDebt[assetType] -= stockToRedeem;
        //burn the token
        assetContract.burn(msg.sender, stockToRedeem);

        uint256 currentChainlinkAssetPrice = getScaledChainlinkPrice(assetType);
        uint256 totalAmount = (currentChainlinkAssetPrice * stockToRedeem) /
            PRECISION;
        uint256 amountToPayInUSDC = convert18ToUSDCDecimal(totalAmount);
    
        uint256 amountFromPerp = perpEngineContract.closeVaultHedge(
            assetType,
            amountToPayInUSDC
        ); 

    
            //reduce the globalBuffer with the balance (this is wrong)
            //needs to confirm this before proceeding
            // if (globalBufferUSDC[assetType] < amountFromPerp) {
            //     //case when global buffer is not enough. what happens
            //     globalBufferUSDC[assetType] = amountFromPerp - 
            //         globalBufferUSDC[assetType];
            // } else {
            //     //case when global buffer is enough
            //     globalBufferUSDC[assetType] -= amountFromPerp;
            // }
          

        return amountFromPerp;
    }

    function syncFundingPnL(
        Utils.Asset asset,
        int256 fundingFee
    ) external onlyPerpEngine {
        //check if we have the asset
        if (asset != Utils.Asset.TSLA && asset != Utils.Asset.APPL) {
            revert InvalidAssetTypeUsed();
        }
            if (fundingFee > 0) {
        globalBufferUSDC[asset] += uint256(fundingFee);// gain → add
    } else if (fundingFee < 0) {
        uint256 loss = uint256(-fundingFee);
        if (globalBufferUSDC[asset] > loss) {
            globalBufferUSDC[asset] -= loss; // loss → subtract
        } else {
            globalBufferUSDC[asset] = 0; // floor at zero
        }
    }
    emit FundingSettled(asset, fundingFee, block.timestamp);

    }

    function setPerpEngine(address _perp) external onlyAdmin {
        require(_perp != address(0), "invalid perp");
        perpEngineContract = PerpEngine(_perp);
        emit PerpEngineUpdated(_perp);
    }

}
