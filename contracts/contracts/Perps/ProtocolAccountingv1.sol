// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { Utils } from "../../lib/Utils.sol";

/// @title ProtocolAccounting
/// @notice Tracks protocol revenue and costs from funding payments and fees per synthetic asset.
/// Funding deltas and fees are recorded here but actual USDC resides in LiquidityPool.
contract ProtocolAccounting is Ownable {
    address public perpEngine; // Only this engine can sync funding
 
    // --- Cumulative accounting ---
    mapping(Utils.Asset => int256) public netFunding;    // Positive: protocol earned, Negative: protocol paid
    mapping(Utils.Asset => uint256) public netFees;      // Total fees collected (bps-adjusted)

    // --- Events ---
    event FundingSynced(Utils.Asset indexed asset, int256 fundingDelta, int256 newNetFunding);
    event FeeSynced(Utils.Asset indexed asset, uint256 feeAmount, uint256 newNetFees);

    constructor(address _perpEngine) Ownable(msg.sender) {
        perpEngine = _perpEngine;
    }

    /// @notice Syncs a funding delta from PerpEngine
    /// @param asset The synthetic asset
    /// @param fundingDelta Positive if shorts paid, negative if longs paid
    function syncFunding(Utils.Asset asset, int256 fundingDelta) external {
        if (msg.sender != perpEngine) revert("Only PerpEngine");

        netFunding[asset] += fundingDelta;
        emit FundingSynced(asset, fundingDelta, netFunding[asset]);
    }

    /// @notice Syncs a fee amount from LiquidityPool
    /// @param asset The synthetic asset
    /// @param feeAmount Amount of USDC fees collected (6 decimals)
    function syncFee(Utils.Asset asset, uint256 feeAmount) external {
        if (msg.sender != perpEngine) revert("Only PerpEngine");

        netFees[asset] += feeAmount;
        emit FeeSynced(asset, feeAmount, netFees[asset]);
    }

    /// @notice Returns protocol PnL for an asset (fees + funding)
    function getProtocolRevenue(Utils.Asset asset) external view returns (int256) {
        // Net protocol revenue = funding income + fee income
        return netFunding[asset] + int256(netFees[asset]);
    }
}
