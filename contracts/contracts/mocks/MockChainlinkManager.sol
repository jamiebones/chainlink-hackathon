// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract MockChainlinkManager {
    mapping(uint8 => uint256) public prices;
    mapping(uint8 => uint256) public dexPrices;

    function setPrice(uint8 asset, uint256 price) external {
        prices[asset] = price;
    }

    function setDexPrice(uint8 asset, uint256 price) external {
        dexPrices[asset] = price;
    }

    function getPrice(uint8 asset) external view returns (uint256) {
        return prices[asset];
    }

    function getDexPriceofAsset(uint8 asset) external view returns (uint256) {
        return dexPrices[asset];
    }
}