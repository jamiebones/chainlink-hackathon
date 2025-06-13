// scripts/deploy.js

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying contract with account:", deployer.address);


  const usdcAddress = "0x5425890298aed601595a70AB815c96711a31Bc65";          // Address of the USDC token contract on Fuji
  const adminAddress = "0x072Ecc90fA0Ac2292e760a57304A87Ad6c32bc89";         // Address of the admin (could be your wallet)
  const chainlinkManagerAddress = "0x888B0fEd1063fdEa9d393c2501673e24A098f5a6"; // Address of the ChainlinkManager contract

 
  const YourContract = await ethers.getContractFactory("Vault");

  const contract = await YourContract.deploy(usdcAddress, adminAddress, chainlinkManagerAddress);

  await contract.waitForDeployment();

  console.log("Contract deployed at:", await contract.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});


// async function main() {
//   const [deployer] = await ethers.getSigners();

//   // TODO: Fill in your actual contract addresses here:
//   const usdcAddress = "0x5425890298aed601595a70AB815c96711a31Bc65"; // USDC Fuji
//   const adminAddress = deployer.address; // Or your desired admin
//   const chainlinkManagerAddress = "0x..."; // Already deployed ChainlinkManager
//   const sTSLAAddress = "0x...";           // Already deployed sTSLA (IAsset)
//   const sAPPLAddress = "0x...";           // Already deployed sAPPL (IAsset)
//   const perpEngineAddress = "0x...";      // Already deployed PerpEngine

//   console.log("Deploying Vault from:", deployer.address);

//   // 1. Deploy the Vault contract
//   const Vault = await ethers.getContractFactory("Vault");
//   const vault = await Vault.deploy(usdcAddress, adminAddress, chainlinkManagerAddress);
//   await vault.waitForDeployment();

//   const vaultAddress = await vault.getAddress();
//   console.log("Vault deployed at:", vaultAddress);

//   // 2. Set fee receiver (admin or other address)
//   const feeReceiverTx = await vault.setFeeReceiver(adminAddress);
//   await feeReceiverTx.wait();
//   console.log("Fee receiver set to:", adminAddress);

//   // 3. Start up protocol: set asset & engine addresses
//   const startTx = await vault.startUpProtocol(sTSLAAddress, sAPPLAddress, perpEngineAddress);
//   await startTx.wait();
//   console.log("Vault protocol started with sTSLA, sAPPL, PerpEngine.");

//   // 4. (Optional) Set Minter/Burner on sTSLA/sAPPL if needed
//   // If you control the asset contracts, you should set the vault as minter/burner. Example:
//   // const sTSLA = await ethers.getContractAt("IAsset", sTSLAAddress);
//   // await sTSLA.setMinter(vaultAddress);
//   // await sTSLA.setBurner(vaultAddress);
//   // const sAPPL = await ethers.getContractAt("IAsset", sAPPLAddress);
//   // await sAPPL.setMinter(vaultAddress);
//   // await sAPPL.setBurner(vaultAddress);

//   console.log("Vault setup complete.");
// }

// main().catch((error) => {
//   console.error(error);
//   process.exitCode = 1;
// });
