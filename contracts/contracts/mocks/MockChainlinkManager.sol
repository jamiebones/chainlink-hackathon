// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "hardhat/console.sol";

enum Asset {
    TSLA,
    APPL,
    GOOGL,
    MSFT,
    AMZN
}

/**
 * @title MockChainlinkManager - Alternative Version
 * @dev Mock that works with Asset enum directly
 */
contract MockChainlinkManager {
    mapping(Asset => uint256) public prices;
    mapping(Asset => uint256) public dexPrices;

    function setPrice(Asset asset, uint256 price) public {
        prices[asset] = price;
    }

    function getPrice(Asset asset) external view returns (uint256) {
        uint256 price = prices[asset];
        return price;
    }

    function setDexPrice(Asset asset, uint256 price) public {
        dexPrices[asset] = price;
    }

    function getDexPrice(Asset asset) external view returns (uint256) {
        return dexPrices[asset];
    }
}