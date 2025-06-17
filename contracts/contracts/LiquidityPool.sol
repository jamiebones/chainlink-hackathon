// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title LiquidityPool
/// @notice USDC pool that backs perpetual trades and synthetic asset redemptions.
/// LPs deposit USDC, earn proportional fees, and hold LP tokens representing their share.
/// This contract manages capital reservation, release, and fee distribution to LPs.
contract LiquidityPool is Ownable, ReentrancyGuard, ERC20 {
    // --- Errors ---
    error ZeroAmount();                   
    error InsufficientLiquidity();        
    error NotPerpMarket();                
    error NotVault();                     
    error OverRelease();                  
    error InsufficientLPBalance();        
    error InsufficientUSDC();             

    // --- External Contracts ---
    IERC20 public immutable usdc;         

    // --- Liquidity Accounting ---
    uint256 public totalLiquidity;        
    uint256 public reservedLiquidity;     
    uint256 public totalFeesCollected;    
    uint256 public totalFeesClaimed;      

    mapping(address => uint256) public userFeeCheckpoint; 

    address public perpMarket;            
    address public vault;                 

    // --- Events ---
    event Deposited(address indexed user, uint256 usdcAmount, uint256 lpTokens);
    event Withdrawn(address indexed user, uint256 usdcAmount, uint256 lpTokens);
    event Reserved(uint256 amount);
    event Released(address to, uint256 amount);
    event ReserveFrom(address from, uint256 amount);
    event FeeClaimed(address indexed user, uint256 amount);
    event FeeCollected(uint256 amount);
    event PoolStats(uint256 totalLiquidity, uint256 reservedLiquidity, uint256 utilizationBps);

    // --- Access Control Modifiers ---
    modifier onlyPerp() {
        if (msg.sender != perpMarket) revert NotPerpMarket();
        _;
    }

    modifier onlyVault() {
        if (msg.sender != vault) revert NotVault();
        _;
    }

    constructor(address _usdc) 
        Ownable(msg.sender) 
        ERC20("Synthetic Equity Liquidity Pool", "SYEQ-LP") 
    {
        usdc = IERC20(_usdc);
    }

    /// @notice Override decimals to match USDC (6 decimals)
    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function setPerpMarket(address _perp) external onlyOwner {
        perpMarket = _perp;
    }

    function setVault(address _vault) external onlyOwner {
        vault = _vault;
    }

    /// @notice Deposit USDC and mint LP tokens
    function deposit(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        if (usdc.balanceOf(msg.sender) < amount) revert InsufficientUSDC();

        uint256 pre = usdc.balanceOf(address(this));
        usdc.transferFrom(msg.sender, address(this), amount);
        uint256 received = usdc.balanceOf(address(this)) - pre;
        require(received > 0, "ZeroReceived");

        uint256 lpAmount = totalSupply()==0 ? received
                        : received * totalSupply() / totalLiquidity;
        totalLiquidity += received;

        _mint(msg.sender, lpAmount);
        _updateFeeCheckpoint(msg.sender);   

        emit Deposited(msg.sender, amount, lpAmount);
    }

    /// @notice Withdraw USDC by burning LP tokens
    function withdraw(uint256 lpAmount) external nonReentrant {
        if (lpAmount == 0) revert ZeroAmount();
        if (balanceOf(msg.sender) < lpAmount) revert InsufficientLPBalance();

        // Claim fees before changing LP balance
        _claimFees(msg.sender);

        uint256 withdrawAmount = (lpAmount * totalLiquidity) / totalSupply();
        if (withdrawAmount > availableLiquidity()) revert InsufficientLiquidity();

        _burn(msg.sender, lpAmount);
        totalLiquidity -= withdrawAmount;
        usdc.transfer(msg.sender, withdrawAmount);

        emit Withdrawn(msg.sender, withdrawAmount, lpAmount);
    }

    /// @notice Called by PerpMarket to reserve liquidity (e.g. margin backing)
    function reserve(uint256 amount) external onlyPerp {
        if (amount == 0) revert ZeroAmount();
        if (amount > availableLiquidity()) revert InsufficientLiquidity();

        reservedLiquidity += amount;
    }

    /// @notice Called by PerpMarket to release liquidity back to a recipient or vault
    function releaseTo(address to, uint256 amount) external onlyPerp {
        if (amount == 0) revert ZeroAmount();
        if (amount > reservedLiquidity) revert OverRelease();

        reservedLiquidity -= amount;
        totalLiquidity -= amount;
        usdc.transfer(to, amount);
        emit Released(to, amount);
    }

    /// @notice Reserve funds directly from vault
    function reserveFrom(address from, uint256 amount) external onlyPerp {
        if (amount == 0) revert ZeroAmount();
        if (usdc.balanceOf(from) < amount) revert InsufficientUSDC();

        usdc.transferFrom(from, address(this), amount);
        totalLiquidity += amount;
        reservedLiquidity += amount;
        emit Reserved(amount);
    }

    /// @notice Adds collected trade fee to pool
    function collectFee(uint256 amount) external onlyPerp {
        if (amount == 0) revert ZeroAmount();
        
        totalLiquidity += amount;
        totalFeesCollected += amount;
        emit FeeCollected(amount);
    }

    /// @notice LPs call this to claim their share of accumulated fees
    function claimFees() external nonReentrant {
        _claimFees(msg.sender);
    }

    /// @notice Claim fees on behalf of another user
    function claimFeesFor(address user) external nonReentrant {
        _claimFees(user);
    }

    /// @dev Internal function that handles fee distribution logic
    function _claimFees(address user) internal {
        uint256 lpBalance = balanceOf(user);
        uint256 supply = totalSupply();
        if (lpBalance == 0 || supply == 0) return;

        uint256 last = userFeeCheckpoint[user];
        uint256 delta = totalFeesCollected - last;
        uint256 share = (lpBalance * delta) / supply;

        if (share > 0) {
            totalLiquidity -= share;
            totalFeesClaimed += share;
            userFeeCheckpoint[user] = totalFeesCollected;
            usdc.transfer(user, share);
            emit FeeClaimed(user, share);
        }
    }

    function _updateFeeCheckpoint(address user) internal {
        if (balanceOf(user) > 0) {
            _claimFees(user);
        } else {
            userFeeCheckpoint[user] = totalFeesCollected;
        }
    }

    function _update(address from, address to, uint256 value) internal override {
        if (from != address(0)) _claimFees(from);
        if (to != address(0) && to != from) _updateFeeCheckpoint(to);
        super._update(from, to, value);
    }

    /// @notice Returns how much a user can claim in unclaimed fees
    function getClaimableFees(address user) external view returns (uint256) {
        uint256 lpBalance = balanceOf(user);
        uint256 supply = totalSupply();
        if (lpBalance == 0 || supply == 0) return 0;

        uint256 delta = totalFeesCollected - userFeeCheckpoint[user];
        return (lpBalance * delta) / supply;
    }

    /// @notice Returns how much liquidity is available (not reserved)
    function availableLiquidity() public view returns (uint256) {
        return totalLiquidity - reservedLiquidity;
    }

    /// @notice Emits stats for frontend dashboards
    function emitPoolStats() external {
        uint256 utilization = totalLiquidity == 0 ? 0 : (reservedLiquidity * 1e4) / totalLiquidity;
        emit PoolStats(totalLiquidity, reservedLiquidity, utilization);
    }
}