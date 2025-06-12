// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MockLiquidityPool {
    IERC20 public usdc;
    uint256 public totalLiquidity;
    uint256 public reservedLiquidity;
    
    // Track operations for testing
    uint256 public reserveCalls;
    uint256 public releaseCalls;
    uint256 public feeCalls;
    
    // 🆕 NEW: Track USDC balance in the pool
    uint256 public poolUSDCBalance;
    
    constructor(address _usdc) {
        usdc = IERC20(_usdc);
        totalLiquidity = 100000 * 10**6; // Default 100k USDC
    }
    
    function setTotalLiquidity(uint256 amount) external {
        totalLiquidity = amount;
    }
    
    function reserve(uint256 amount) external {
        require(amount > 0, "Amount must be > 0");
        require(amount <= totalLiquidity - reservedLiquidity, "Insufficient liquidity");
        reservedLiquidity += amount;
        reserveCalls++;
    }
    
    function releaseTo(address to, uint256 amount) external {
        require(amount > 0, "Amount must be > 0");
        require(amount <= reservedLiquidity, "Amount exceeds reserved");
        require(to != address(0), "Invalid recipient");
        
        reservedLiquidity -= amount;
        releaseCalls++;
        
        // 🔄 FIXED: Actually transfer USDC if we have it
        if (poolUSDCBalance >= amount) {
            poolUSDCBalance -= amount;
            require(usdc.transfer(to, amount), "Transfer failed");
        }
        // If we don't have enough USDC, just track the call (for testing)
    }
    
    function reserveFrom(address from, uint256 amount) external {
        require(amount > 0, "Amount must be > 0");
        require(from != address(0), "Invalid from address");
        
        // 🔄 FIXED: Actually transfer USDC from the 'from' address
        require(usdc.transferFrom(from, address(this), amount), "TransferFrom failed");
        poolUSDCBalance += amount;
        reservedLiquidity += amount;
        reserveCalls++;
    }
    
    function collectFee(uint256 amount) external {
        require(amount > 0, "Amount must be > 0");
        feeCalls++;
        
        // 🆕 NEW: For collectFee, we expect the USDC to already be transferred to us
        // This function is called AFTER the transfer in your PerpEngine
        // So we just need to track it
    }
    
    // 🆕 NEW: Function to handle direct USDC transfers (when PerpEngine sends USDC to pool)
    function receiveUSDC(uint256 amount) external {
        // This can be called after a transfer to update our internal balance
        poolUSDCBalance += amount;
    }
    
    // 🆕 NEW: Allow the pool to receive USDC by checking balance
    function syncUSDCBalance() external {
        uint256 actualBalance = usdc.balanceOf(address(this));
        poolUSDCBalance = actualBalance;
    }
    
    // Helper functions for testing
    function resetCounters() external {
        reserveCalls = 0;
        releaseCalls = 0;
        feeCalls = 0;
    }
    
    function getPoolUSDCBalance() external view returns (uint256) {
        return poolUSDCBalance;
    }
    
    function getActualUSDCBalance() external view returns (uint256) {
        return usdc.balanceOf(address(this));
    }
}