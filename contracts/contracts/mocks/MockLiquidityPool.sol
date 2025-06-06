// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract MockLiquidityPool {
    uint256 public totalLiquidity = 1_000_000 * 1e6;
    uint256 public reserved;

    function reserve(uint256 amount) external {
        reserved += amount;
    }

    function release(uint256 amount) external {
        if (reserved >= amount) {
            reserved -= amount;
        }
    }

    function reservedLiquidity() external view returns (uint256) {
        return reserved;
    }
}
