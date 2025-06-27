// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MockUSDC is ERC20, Ownable {
    bool public transferShouldFail;

    constructor() ERC20("USD Coin", "USDC") Ownable(msg.sender) {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function setTransferShouldFail(bool _shouldFail) external {
        transferShouldFail = _shouldFail;
    }

    function transfer(
        address to,
        uint256 amount
    ) public override returns (bool) {
        if (transferShouldFail) return false;
        return super.transfer(to, amount);
    }

    function transferFrom(
        address from,
        address to,
        uint256 amount
    ) public override returns (bool) {
        if (transferShouldFail) return false;
        return super.transferFrom(from, to, amount);
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }
}
