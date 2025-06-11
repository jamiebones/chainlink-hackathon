// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./SYEQ-LP.sol";

/// -----------------------
/// Liquidity Pool Contract
/// -----------------------
/// @title LiquidityPool - Handles LP deposits, withdrawals, and liquidity reservation for PerpMarket
contract LiquidityPool {
    IERC20 public collateralToken; // USDC or similar stablecoin
    LPToken public lpToken;
    address public market; // Authorized market contract

    uint256 public totalLiquidity; // Total tokens held in the pool
    uint256 public reservedLiquidity; // Portion reserved for open perp positions
    uint256 public totalCollateralDeposited; // Total ever deposited by LPs
    uint256 public totalCollateralWithdrawn; // Total ever withdrawn by LPs

    /// --- Events ---
    event Deposit(address indexed user, uint256 amount, uint256 sharesMinted);
    event Withdraw(address indexed user, uint256 sharesBurned, uint256 amount);
    event Reserve(address indexed market, uint256 amount);
    event Release(address indexed market, uint256 amount);
    event MarketSet(address indexed newMarket);

    /// --- Errors ---
    error OnlyMarket();
    error AlreadySet();
    error ZeroAmount();
    error TransferFailed();
    error InsufficientShares();
    error InsufficientFreeLiquidity();
    error NotReserved();

    constructor(address _collateralToken) {
        collateralToken = IERC20(_collateralToken);
        lpToken = new LPToken();
    }

    modifier onlyMarket() {
        if (msg.sender != market) revert OnlyMarket();
        _;
    }

    function setMarket(address _market) external {
        if (market != address(0)) revert AlreadySet();
        market = _market;
        emit MarketSet(_market);
    }

    /// @notice LPs deposit collateralToken in exchange for LP shares
    function deposit(uint256 amount) external {
        if (amount == 0) revert ZeroAmount();
        if (!collateralToken.transferFrom(msg.sender, address(this), amount)) revert TransferFailed();

        uint256 shares = (totalLiquidity == 0 || lpToken.totalSupply() == 0)
            ? amount
            : (amount * lpToken.totalSupply()) / totalLiquidity;

        lpToken.mint(msg.sender, shares);
        totalLiquidity += amount;
        totalCollateralDeposited += amount;

        emit Deposit(msg.sender, amount, shares);
    }

    /// @notice LPs withdraw their proportional share of liquidity
    function withdraw(uint256 shares) external {
        if (shares == 0) revert ZeroAmount();
        if (lpToken.balanceOf(msg.sender) < shares) revert InsufficientShares();

        uint256 amount = (shares * totalLiquidity) / lpToken.totalSupply();
        if (amount > (totalLiquidity - reservedLiquidity)) revert InsufficientFreeLiquidity();

        lpToken.burn(msg.sender, shares);
        totalLiquidity -= amount;
        totalCollateralWithdrawn += amount;

        if (!collateralToken.transfer(msg.sender, amount)) revert TransferFailed();

        emit Withdraw(msg.sender, shares, amount);
    }

    /// @notice Called by PerpMarket to lock liquidity to back user positions
    function reserve(uint256 amount) external onlyMarket {
        if ((totalLiquidity - reservedLiquidity) < amount) revert InsufficientFreeLiquidity();
        reservedLiquidity += amount;
        emit Reserve(msg.sender, amount);
    }

    /// @notice Called when positions are closed and liquidity is unlocked
    function release(uint256 amount) external onlyMarket {
        if (reservedLiquidity < amount) revert NotReserved();
        reservedLiquidity -= amount;
        emit Release(msg.sender, amount);
    }

    /// @notice Called by market to send reserved collateral to a user
    function releaseTo(address recipient, uint256 amount) external onlyMarket {
        if (reservedLiquidity < amount) revert NotReserved();
        reservedLiquidity -= amount;
        totalLiquidity -= amount;
        if (!collateralToken.transfer(recipient, amount)) revert TransferFailed();
        emit Release(msg.sender, amount);
    }

    function availableLiquidity() external view returns (uint256) {
        return totalLiquidity - reservedLiquidity;
    }
}
