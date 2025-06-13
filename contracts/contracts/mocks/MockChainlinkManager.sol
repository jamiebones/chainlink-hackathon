// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../../lib/Utils.sol";

contract MockChainlinkManager {
    mapping(Utils.Asset => uint256) private prices;
    mapping(Utils.Asset => uint256) private dexPrices;
    mapping(Utils.Asset => bool) private assetPaused;
    bool private marketOpen;

    function setPrice(Utils.Asset assetType, uint256 price) external {
        require(price > 0, "Price must be greater than 0");
        prices[assetType] = price;
    }

    function setDexPrice(Utils.Asset assetType, uint256 price) external {
        require(price > 0, "Price must be greater than 0");
        dexPrices[assetType] = price;
    }

    function setMarketOpen(bool _isOpen) external {
        marketOpen = _isOpen;
    }

    function setPaused(Utils.Asset assetType, bool isPaused) external {
        assetPaused[assetType] = isPaused;
    }

    function getPrice(Utils.Asset assetType) external view returns (uint256) {
        uint256 price = prices[assetType];
        require(price > 0, "Price not set");
        return price;
    }

    function getDexPrice(
        Utils.Asset assetType
    ) external view returns (uint256) {
        uint256 price = dexPrices[assetType];
        require(price > 0, "DEX price not set");
        return price;
    }

    function getTwapPriceofAsset(
        Utils.Asset assetType
    ) external view returns (uint256) {
        uint256 price = dexPrices[assetType];
        require(price > 0, "TWAP price not set");
        return price;
    }

    function isMarketOpen() external view returns (bool) {
        return marketOpen;
    }

    function checkIfAssetIsPaused(
        Utils.Asset assetType
    ) external view returns (bool) {
        return assetPaused[assetType];
    }
}
