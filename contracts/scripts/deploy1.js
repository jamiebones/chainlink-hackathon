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
