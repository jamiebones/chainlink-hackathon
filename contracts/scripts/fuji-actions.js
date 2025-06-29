const { ethers } = require("hardhat");
require("dotenv").config();

 const sTSLAOracleManagerAddress = "0x70671A042B419B266d36212337eEC2A715Af603c" //Fuji
 const vaultAddress = "0xFeFf49844Cf2bd6c07806f86FcDeFE55786De8a4"; //fuji
 const receiverContractAddress = "0xDbA42976c2139Ccc9450a5867bFEb214892b8d4D"; //On Fuji Chain
 const deployer = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, ethers.provider);
 const sourceChainSelector = 16015286601757825753n; 
 const vaultContractSenderAddress = "0x343d00b0c2fD67cA9dD1E34e2dA820F62f3f988F" //sepolia

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

    console.log("starting to send request to Tsla Oracle");
    const sTSLAOracleManagerContract = await ethers.getContractAt("TSLAOracleManager", sTSLAOracleManagerAddress);
    await sTSLAOracleManagerContract.connect(deployer).sendRequest(15656);
    console.log("finish sending request to Tsla Oracle");
}


main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });