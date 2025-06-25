const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

 const vaultAddress = "";
 const receiverContractAddress = ""; //On Fuji Chain
 const deployer = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, ethers.provider);
 const sourceChainSelector = 16015286601757825753n; 
 const vaultContractSenderAddress = ""

 async function main() {
    //get the receiver contract and set the sourse destination🧮 
    let tx;
    const receiverContract = await ethers.getContractAt("ReceiverContract", receiverContractAddress);
    
    console.log("Setting source destination for ReceiverContract...");
    tx = await receiverContract.connect(deployer).setSenderForSourceChain(
        sourceChainSelector, //Sepolia
        vaultContractSenderAddress, //Vault Contract Sender Address
    );
    console.log("Transaction hash:", tx.hash);
    await tx.wait();
    console.log("Source destination set successfully.");

    
    const vault = await ethers.getContractAt("Vault", vaultAddress);
    
    console.log("Setting receiver contract in vault...");
    tx = await vault.connect(deployer).setReceiverContract(
        receiverContractAddress, //Fuji
    );
    await tx.wait();
    console.log("receiver contract set in Vault.");
}


main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });