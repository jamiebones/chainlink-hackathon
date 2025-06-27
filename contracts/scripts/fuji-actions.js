const { ethers } = require("hardhat");
require("dotenv").config();

 const sTSLAOracleManagerAddress = "0x70671A042B419B266d36212337eEC2A715Af603c" //Fuji
 const vaultAddress = "0x561B0fcC18D09dBa76c68Fa0910AcFf58A1EF6E2"; //fuji
 const receiverContractAddress = "0x60D5A7f7f49D307e36AadAd994EF2e164a42BA54"; //On Fuji Chain
 const deployer = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, ethers.provider);
 const sourceChainSelector = 16015286601757825753n; 
 const vaultContractSenderAddress = "0xC29534f3B12658E58FEf15a454A284eC271C7297" //sepolia

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