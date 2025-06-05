// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// --------------------
/// LP Token Definition
/// --------------------
/// @title LPToken - ERC20 token representing LP shares for synthetic equity protocol
contract LPToken is ERC20, Ownable {
    constructor() ERC20("SYEQ Liquidity Share Token", "SYEQ-LS") Ownable(msg.sender) {}

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external onlyOwner {
        _burn(from, amount);
    }
}
