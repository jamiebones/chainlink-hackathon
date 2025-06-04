// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract sAPPL is ERC20 {
    address public vault;

    error OnlyVault();


    modifier onlyVault() {
        if (msg.sender != vault) revert OnlyVault();
        _;
    }
    constructor() ERC20("Synthetic APPL", "sAPPL") {}

    function mint(address to, uint256 amount) external onlyVault {
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external onlyVault {
        _burn(from, amount);
    }
}