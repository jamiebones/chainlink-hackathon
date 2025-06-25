//0x888B0fEd1063fdEa9d393c2501673e24A098f5a6
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;


import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";
import {Client} from "@chainlink/contracts-ccip/contracts/libraries/Client.sol";
import {CCIPReceiver} from "@chainlink/contracts-ccip/contracts/applications/CCIPReceiver.sol";
import {IERC20} from "@chainlink/contracts/src/v0.8/vendor/openzeppelin-solidity/v4.8.3/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@chainlink/contracts/src/v0.8/vendor/openzeppelin-solidity/v4.8.3/contracts/token/ERC20/utils/SafeERC20.sol";
import {EnumerableMap} from "@chainlink/contracts/src/v0.8/vendor/openzeppelin-solidity/v4.8.3/contracts/utils/structs/EnumerableMap.sol";
import {AAPLOracleManager} from "./AAPLOracleManager.sol";
import {TSLAOracleManager} from "./TSLAOracleManager.sol";
import {MarketStatusOracle} from "./MarketStatusOracle.sol";
import {Utils} from "../lib/Utils.sol";


contract ChainlinkManager {
    
    AAPLOracleManager aAPLOracleManager;
    TSLAOracleManager tSLAOracleManager;
    MarketStatusOracle marketStatusOracle;

    uint256 public constant PRECISION = 1e18; //18 decimals


    error InvalidAssetType();

    constructor(address _tslaOracleManagerAddress, address _aaplOracleManagerAddress, address _marketStatusOraclleAddress) {
       aAPLOracleManager = AAPLOracleManager(_aaplOracleManagerAddress);
       tSLAOracleManager = TSLAOracleManager(_tslaOracleManagerAddress);
       marketStatusOracle = MarketStatusOracle(_marketStatusOraclleAddress);
    }

    /// @dev Fetch latest price from Chainlink Data Feed
    function getPrice(Utils.Asset assetType) public view returns (uint256) {
        
        if (assetType == Utils.Asset.TSLA) {
           return tSLAOracleManager.getPriceTSLA() * 1e16; //18 decimals
        } else if (assetType == Utils.Asset.APPL) {
           return aAPLOracleManager.getPriceAAPL() * 1e16; //18 decimals 
        } else {
            revert InvalidAssetType();
        }
        
    }

    function getTwapPriceofAsset(
        Utils.Asset assetType
    ) public view returns (uint256) {
           if (assetType == Utils.Asset.TSLA) {
           return tSLAOracleManager.twap() * 1e16; //18 decimals
        } else if (assetType == Utils.Asset.APPL) {
           return aAPLOracleManager.twap() * 1e16; //18 decimals 
        } else {
            revert InvalidAssetType();
        }
    }

    function checkIfAssetIsPaused(Utils.Asset assetType) external view returns (bool){
             if (assetType == Utils.Asset.TSLA) {
           return tSLAOracleManager.isPaused();
        } else if (assetType == Utils.Asset.APPL) {
           return aAPLOracleManager.isPaused();
        } else {
            revert InvalidAssetType();
        }
    }

    function isMarketOpen() public view returns (bool){
        return marketStatusOracle.isMarketOpen();
    }

    function getDexPrice(Utils.Asset asset) external view returns(uint256){
        return getPrice(asset);
    } 



   function calculateSharesAndMintFeeFromUSDCPaid(Utils.Asset asset, uint256 usdcAmount) 
   external view returns (uint256, uint256, uint256, uint256) {
    require(marketStatusOracle.isMarketOpen(), "market not open");
    uint256 assetDexPrice = getPrice(asset);
    require(assetDexPrice != 0, "asset price cannot be zero");
    uint256 assetTwapPrice = getTwapPriceofAsset(asset);
    uint256 mintFeePercentage = Utils.calculateMintFee(assetTwapPrice, assetDexPrice);

    // Convert USDC amount to 18 decimals
    uint256 usdcAmount18 = usdcAmount * 1e12;
    
    // Calculate denominator
    uint256 denominator = (11 * PRECISION) + (10 * mintFeePercentage);
    require(denominator != 0, "denominator cannot be zero");
    
    // Calculate notional value in 18 decimals
    uint256 notionalUSD18 = (usdcAmount18 * 10 * PRECISION) / denominator;
    
    // Calculate mint fee in USDC (6 decimals) - ADDED FOR REFERENCE
    uint256 mintFeeUSD18 = (mintFeePercentage * notionalUSD18) / PRECISION;
    uint256 mintFeeUSDC = mintFeeUSD18 / 1e12;
    // Calculate shares
    uint256 shares = (notionalUSD18 * PRECISION) / assetDexPrice;
    return (shares, mintFeeUSDC, notionalUSD18, assetDexPrice);
}
   
}
