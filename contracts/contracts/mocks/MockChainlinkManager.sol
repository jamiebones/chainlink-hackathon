// SPDX-License-Identifier: MIT

pragma solidity ^0.8.28;

import {Utils} from "../../lib/Utils.sol";

contract MockChainlinkManager {
    mapping(Utils.Asset => uint256) public prices;
    mapping(Utils.Asset => uint256) public dexPrices;

    function setPrice(Utils.Asset asset, uint256 price) external {
        prices[asset] = price;
    }

    function setDexPrice(Utils.Asset asset, uint256 price) external {
        dexPrices[asset] = price;
    }

    function getPrice(Utils.Asset asset) external view returns (uint256) {
        return prices[asset];
    }

    function getDexPriceofAsset(
        Utils.Asset asset
    ) external view returns (uint256) {
        return dexPrices[asset];
    }
}
