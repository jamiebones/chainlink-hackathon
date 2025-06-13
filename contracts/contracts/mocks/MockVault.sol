// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

enum Asset {
    TSLA,
    APPL,
    GOOGL,
    MSFT,
    AMZN
}

interface IPerpEngine {
    function openVaultHedge(Asset asset, uint256 amount) external returns (bytes32);
    function closeVaultHedge(Asset asset, uint256 amount) external returns (uint256);
}

contract MockVault {
    // Track fees by asset
    mapping(Asset => uint256) public feesByAsset;  // or mapping(Utils.Asset => uint256)
    uint256 public totalFees;

    // Track funding PnL by asset  
    mapping(Asset => int256) public fundingPnLByAsset;
    int256 public totalFundingPnL;

    // Events
    event FeeSynced(Asset asset, uint256 fee);
    event FundingPnLSynced(Asset asset, int256 fundingDelta);

    // This is the missing function
    function syncFee(Asset asset, uint256 fee) external {
        feesByAsset[asset] += fee;
        totalFees += fee;
        
        // Optional: emit event for testing
        emit FeeSynced(asset, fee);
    }

    function syncFundingPnL(Asset asset, int256 fundingDelta) external {
        fundingPnLByAsset[asset] += fundingDelta;
        totalFundingPnL += fundingDelta;
        
        emit FundingPnLSynced(asset, fundingDelta);
    }

    function openHedgePosition(address perpEngine, Asset asset, uint256 amount) external {
        IPerpEngine(perpEngine).openVaultHedge(asset, amount);
    }

    function closeHedgePosition(address perpEngine, Asset asset, uint256 amount) external returns (uint256) {
        return IPerpEngine(perpEngine).closeVaultHedge(asset, amount);
    }

    // View functions for testing
    function getTotalFees() external view returns (uint256) {
        return totalFees;
    }

    function getFeesForAsset(Asset asset) external view returns (uint256) {
        return feesByAsset[asset];
    }

     function approveToken(address token, address spender, uint256 amount) external {
        IERC20(token).approve(spender, amount);
    }

    // Optional: Helper function to check allowance
    function checkAllowance(address token, address spender) external view returns (uint256) {
        return IERC20(token).allowance(address(this), spender);
    }
}