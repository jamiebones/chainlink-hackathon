//0x888B0fEd1063fdEa9d393c2501673e24A098f5a6
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Utils} from "../lib/Utils.sol";
import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";
import {AAPLOracleManager} from "./AAPLOracleManager.sol";
import {TSLAOracleManager} from "./TSLAOracleManager.sol";
import {MarketStatusOracle} from "./MarketStatusOracle.sol";


contract ChainlinkManager {
    
    AAPLOracleManager aAPLOracleManager;
    TSLAOracleManager tSLAOracleManager;
    MarketStatusOracle marketStatusOracle;


    error InvalidAssetType();

    constructor(address _tslaOracleManagerAddress, address _aaplOracleManagerAddress, address _marketStatusOraclleAddress) {
       aAPLOracleManager = AAPLOracleManager(_aaplOracleManagerAddress);
       tSLAOracleManager = TSLAOracleManager(_tslaOracleManagerAddress);
       marketStatusOracle = MarketStatusOracle(_marketStatusOraclleAddress);
    }

    /// @dev Fetch latest price from Chainlink Data Feed
    function getPrice(Utils.Asset assetType) external view returns (uint256) {
        
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
    ) external view returns (uint256) {
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
}
