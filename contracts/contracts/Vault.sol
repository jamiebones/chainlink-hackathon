// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ChainlinkManager} from "./ChainlinkManager.sol";
import {Utils} from "../lib/Utils.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {IAsset} from "../interfaces/IAsset.sol";
import {LiquidityPool} from "./LiquidityPool.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract Vault is ReentrancyGuard {
    address public admin;
    // uint256 public totalBufferCollateralBalance;
    // uint256 public totalHedgedCollateralBalance;
    uint256 public constant PRECISION = 1e18; //18 decimals
    uint256 public constant USDC_PRECISION = 1e6; //6 decimals
    uint256 public constant CHAINLINK_PRECISION = 1e8; //8 decimals
    uint256 public constant PERCENTAGE_COLLATERAL = 110 * 1e16; //18 decimals


    bool public isStarted;

    ChainlinkManager public chainlinkManager;
    LiquidityPool public liquidityPool;
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
    mapping(Utils.Asset => uint256) public totalVaultDebt; //Total sTSLA minted by all users (denotes protocol’s synthetic liability)
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
        uint256 mintedAmount,
        uint256 amountRefunded,
        uint256 redemtionFee,
        uint256 bufferCollateral,
        uint256 hedgedCollateral,
        uint256 entryPrice,
        uint256 date,
        Utils.Asset assetType
    );

    constructor(address _usdc, address _admin, address _chainlinkManager, address _liquidityPool) {
        chainlinkManager = ChainlinkManager(_chainlinkManager);
        liquidityPool = LiquidityPool(_liquidityPool);
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
       _checkPriceAndMarketStatus(assetType);

        // Initialize assetContract safely
        IAsset assetContract = assetType == Utils.Asset.TSLA ? sTSLA : sAPPL;

        uint256 chainLinkEntryPrice = getScaledChainlinkPrice(assetType);
        uint256 twapPrice = getScaledTwapPrice(assetType);
        uint256 mintFeePercentage = _calculateMintFee(
            twapPrice,
            chainLinkEntryPrice
        );

        uint256 amountForSharesInUSD = (chainLinkEntryPrice * numofShares) /
            PRECISION;
        uint256 collacteralForSharesInUSD = (amountForSharesInUSD *
            PERCENTAGE_COLLATERAL) / PRECISION;
        uint256 mintFee = (mintFeePercentage * collacteralForSharesInUSD) /
            PRECISION;

        uint256 totalCollacteralInUSDCToPay = convert18ToUSDCDecimal(
            collacteralForSharesInUSD
        );

        uint256 bufferCollacteral = totalCollacteralInUSDCToPay / 10;
        uint256 hedgeCollacteral = totalCollacteralInUSDCToPay - bufferCollacteral;
        uint256 totalCollacteralInUSDCToPayPlusMintFee = convert18ToUSDCDecimal(
            collacteralForSharesInUSD +
            mintFee
        );

        //increment user buffer collateral and vault debt
        totalUserBufferUSDC[assetType] += bufferCollacteral;
        totalVaultDebt[assetType] += hedgeCollacteral;
        globalBufferUSDC[assetType] += bufferCollacteral;

        //build and save the new vault
        uint256 newIndex = userPositionCount[msg.sender];

        SyntheticSlot memory newVault = SyntheticSlot({
            trader: msg.sender,
            mintedAmount: numofShares,
            bufferCollateral: bufferCollacteral,
            hedgedCollateral: hedgeCollacteral,
            entryPrice: chainLinkEntryPrice,
            assetType: assetType,
            positionIndex: newIndex,
            paidOut: false,
            isActive: true,
            timestamp: block.timestamp
        });

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
        

        //deposit the money in the in house pool => to be implemented 
        //hedgeCollateral gets deposisted to the in house perps protocol
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

    function redeemStock(
        Utils.Asset assetType,
        uint256 stockToRedeem
    ) external nonReentrant {
        //check if their balance is greater than the stockToRedeem
        if (!isStarted) revert NotStarted();
        
        _checkPriceAndMarketStatus(assetType);

        uint256 amountOfSharesInUSDC = _calculateUserAssetRedemption(assetType, stockToRedeem);

        uint256 currentChainlinkAssetPrice = getScaledChainlinkPrice(assetType);
        uint256 currentDexAssetPrice = getScaledTwapPrice(assetType);
        uint256 redemptionPercentage = _calculateRedeemFee(
            currentChainlinkAssetPrice,
            currentDexAssetPrice
        );

        uint256 redemptionFee = (amountOfSharesInUSDC * redemptionPercentage) /
            PRECISION;

        uint256 amountToPayUser = amountOfSharesInUSDC - redemptionFee;
        //check if ths contract has this fee
        if (usdcContract.balanceOf(address(this)) < amountOfSharesInUSDC + redemptionFee) {
            revert InsufficientFundForPayout();
        }
       
        //the redemption fee goes to the liquidity pool: Need to add
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

        liquidityPool.deposit(redemptionFee);

        //close the position here by calling the Perps Engine contract

        
        
    }

 

    function redeemVault(uint256 vaultID, uint256 portionToRedeem) external {
        //check if the vault is present and has not been redeemed already
        if (!isStarted) revert NotStarted();
        require(vaultID < userPositionCount[msg.sender], "Invalid vault ID");
        
        if (portionToRedeem == 0) revert InsufficientTokenAmountSpecified();
        
        SyntheticSlot storage vault = userPositions[msg.sender][vaultID];
        if (vault.trader == address(0)) {
            revert InvalidVaultID();
        }
        if (vault.mintedAmount == 0 ){
            revert VaultAlreadyPaidOut();
        }
        if (vault.paidOut) {
            revert VaultAlreadyPaidOut();
        }
        require(portionToRedeem <= vault.mintedAmount, "Redeem amount exceeds minted amount");
        uint256 userShareBuffer = _processAssetBufferPayment(vault, portionToRedeem);
        uint256 userAssetRedemption = _calculateUserAssetRedemption(
            userPositions[msg.sender][vaultID].assetType,
            portionToRedeem
        );
        //calculate the curent price of the stock
        uint256 currentChainlinkAssetPrice = getScaledChainlinkPrice(
            vault.assetType
        );
        uint256 currentDexAssetPrice = getScaledTwapPrice(vault.assetType);
        uint256 redemptionPercentage = _calculateRedeemFee(
            currentChainlinkAssetPrice,
            currentDexAssetPrice
        );

        uint256 redemtionFee = ((userAssetRedemption + userShareBuffer) * redemptionPercentage) /
            PRECISION;

        uint256 amountToPayUser = userAssetRedemption + userShareBuffer - redemtionFee;


        //close the position


        //transfer the fee to the user 

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


        emit PositionClosed({
            trader: msg.sender,
            positionId: vault.positionIndex,
            assetType: vault.assetType,
            mintedAmount: vault.mintedAmount,
            redemtionFee: redemtionFee,
            amountRefunded: amountToPayUser,
            hedgedCollateral: vault.hedgedCollateral,
            bufferCollateral: vault.bufferCollateral,
            entryPrice: vault.entryPrice,
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

    function _checkPriceAndMarketStatus(Utils.Asset assetType) private view returns (bool) {
        if (!isStarted) revert NotStarted();
        
        if (assetType != Utils.Asset.TSLA && assetType != Utils.Asset.APPL) {
            revert InvalidAssetTypeUsed();
        }

        if (!chainlinkManager.isMarketOpen()){
            revert MarketNotOpen();
        }

        if (chainlinkManager.checkIfAssetIsPaused(assetType)){
            revert CircuitBreakerActivatedForAsset(assetType);
        }
        return true;
    }

    

    function _processAssetBufferPayment( SyntheticSlot storage vault, uint256 tokenToRedeem) private returns (uint256){
           //get the vault;
      
        //check the assetType of the asset;
        IAsset assetContract = vault.assetType == Utils.Asset.TSLA ? sTSLA : sAPPL;
        //get the balance of the synthetic asset owned by the user;
        uint256 traderBalanceofAsset = assetContract.balanceOf(msg.sender);
        if (traderBalanceofAsset < tokenToRedeem) {
            revert InsufficientTokenAmountSpecified();
        }

        require(tokenToRedeem > 0 && tokenToRedeem <= vault.mintedAmount, "Invalid amount");
        uint256 redeemPortion = (tokenToRedeem  * PRECISION) / vault.mintedAmount;

        //update the vault here
        vault.mintedAmount -= tokenToRedeem;
        uint256 userOriginalBufferShare = vault.bufferCollateral * redeemPortion / PRECISION;
        require(totalUserBufferUSDC[vault.assetType] > 0, "Division by zero");
        uint userBuferShare = userOriginalBufferShare * (globalBufferUSDC[vault.assetType] / totalUserBufferUSDC[vault.assetType]);

        vault.bufferCollateral -= userOriginalBufferShare;
        vault.hedgedCollateral -= (vault.hedgedCollateral * redeemPortion) / PRECISION;

        if (vault.mintedAmount == 0) {
            vault.paidOut = true;
            vault.isActive = false;
        }

        globalBufferUSDC[vault.assetType] -= userBuferShare;
        totalUserBufferUSDC[vault.assetType] -= userOriginalBufferShare;
        return userBuferShare;
    }

    function _calculateUserAssetRedemption(Utils.Asset assetType, uint256 stockToRedeem) private returns (uint256){
          if (!isStarted) revert NotStarted();
        
        _checkPriceAndMarketStatus(assetType);

        if (stockToRedeem == 0) revert InsufficientTokenAmountSpecified();

        // Initialize assetContract safely
        IAsset assetContract = assetType == Utils.Asset.TSLA ? sTSLA : sAPPL;
        uint256 traderBalanceofAsset = assetContract.balanceOf(msg.sender);

        if (traderBalanceofAsset < stockToRedeem) {
            revert StocksToReddemLowerThanUserBalance();
        }

        uint256 currentChainlinkAssetPrice = getScaledChainlinkPrice(assetType);
        uint256 totalAmount = (currentChainlinkAssetPrice * stockToRedeem) / PRECISION;
        uint256 amountToPayInUSDC = convert18ToUSDCDecimal(totalAmount);
        //burn the token:
        assetContract.burn(msg.sender, stockToRedeem);
        //the redemption fee goes to the liquidity pool: Need to add
        uint256 shareAmountInUSDC = convert18ToUSDCDecimal(totalAmount);

        //reduce the vault debt here:
        totalVaultDebt[assetType] -= shareAmountInUSDC;
        
        return amountToPayInUSDC;
        //close the position by calling the Perps Engine contract

        //reduce the totalDebtOfTheContract

    }
}
