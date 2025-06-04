// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MockAsset is ERC20, Ownable {
    address public minter;
    address public burner;
    
    constructor() ERC20("Synthetic Asset", "SYNTH") Ownable(msg.sender) {}
    
    function setMinter(address _minter) external onlyOwner {
        minter = _minter;
    }
    
    function setBurner(address _burner) external onlyOwner {
        burner = _burner;
    }
    
    function mint(address to, uint256 amount) external {
        require(msg.sender == minter, "Only minter can mint");
        _mint(to, amount);
    }
    
    function burn(address from, uint256 amount) external {
        require(msg.sender == burner, "Only burner can burn");
        _burn(from, amount);
    }
}