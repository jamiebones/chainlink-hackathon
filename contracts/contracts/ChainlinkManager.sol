// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Utils} from "../lib/Utils.sol";
import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";

contract ChainlinkManager {
    address public constant TSLA_USD_FEED =
        0x3609baAa0a9b1f0FE4d6CC01884585d0e191C3E3; //on Arbitruim
    address public constant APPL_USD_FEED =
        0x8d0CC5f38f9E802475f2CFf4F9fc7000C2E1557c; //on Arbitruim
    AggregatorV3Interface public TSLA_dataFeed;
    AggregatorV3Interface public APPL_dataFeed;

    error InvalidAssetType();

    constructor() {
        TSLA_dataFeed = AggregatorV3Interface(TSLA_USD_FEED);
        APPL_dataFeed = AggregatorV3Interface(APPL_USD_FEED);
    }

    /// @dev Fetch latest price from Chainlink Data Feed
    function getPrice(Utils.Asset assetType) external view returns (uint256) {
        AggregatorV3Interface dataFeed;
        if (assetType == Utils.Asset.TSLA) {
            dataFeed = TSLA_dataFeed;
        } else if (assetType == Utils.Asset.APPL) {
            dataFeed = APPL_dataFeed;
        } else {
            revert InvalidAssetType();
        }
        (
            ,
            /* uint80 roundId */ int256 answer /*uint256 startedAt*/ /*uint256 updatedAt*/ /*uint80 answeredInRound*/,
            ,
            ,

        ) = dataFeed.latestRoundData();
        return uint256(answer);
    }

    function getDexPriceofAsset(
        Utils.Asset assetType
    ) external view returns (uint256) {
        return 1e18; //for now
    }
}
