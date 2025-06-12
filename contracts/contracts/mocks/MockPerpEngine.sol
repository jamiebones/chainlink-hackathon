// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../../lib/Utils.sol";

contract MockPerpEngine {
    uint256 public totalFees;
    mapping(Utils.Asset => uint256) public hedgedPositions;
    mapping(Utils.Asset => bytes32) public positionIds;
    uint256 private nextPositionId = 1;
    
    // Add this state variable and function
    uint256 public closeVaultHedgeReturnValue;
    function setCloseVaultHedgeReturnValue(uint256 value) external {
        closeVaultHedgeReturnValue = value;
    }

    function openVaultHedge(
        Utils.Asset asset,
        uint256 amount
    ) external returns (bytes32) {
        require(amount > 0, "Amount must be greater than 0");
        hedgedPositions[asset] += amount;
        bytes32 positionId = bytes32(abi.encodePacked(asset, nextPositionId++));
        positionIds[asset] = positionId;
        return positionId;
    }

    // Add this new function
    function closeVaultHedge(Utils.Asset, uint256) external returns (uint256) {
        return closeVaultHedgeReturnValue;
    }

    function addFeesToPool(uint256 fees) external {
        require(fees > 0, "Fees must be greater than 0");
        totalFees += fees;
    }

    function getPositionId(Utils.Asset asset) external view returns (bytes32) {
        return positionIds[asset];
    }
}