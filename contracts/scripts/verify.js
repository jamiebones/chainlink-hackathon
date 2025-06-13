const { run } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("Starting contract verification...\n");

  // Load deployment info
  const network = await ethers.provider.getNetwork();
  const deploymentPath = path.join(__dirname, `../deployments/${network.name}_deployment.json`);
  
  if (!fs.existsSync(deploymentPath)) {
    console.error(`❌ Deployment file not found: ${deploymentPath}`);
    console.error("Run the deployment script first!");
    process.exit(1);
  }

  const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
  const contracts = deployment.contracts;

  // Verification configurations
  const verifyConfigs = [
    {
      name: "USDC",
      address: contracts.usdc,
      constructorArguments: ["USD Coin", "USDC", 6]
    },
    {
      name: "MarketStatusOracle",
      address: contracts.marketStatusOracle,
      constructorArguments: []
    },
    {
      name: "TSLAOracleManager",
      address: contracts.tslaOracle,
      constructorArguments: [60, contracts.marketStatusOracle]
    },
    {
      name: "AAPLOracleManager", 
      address: contracts.aaplOracle,
      constructorArguments: [60, contracts.marketStatusOracle]
    },
    {
      name: "ChainlinkManager",
      address: contracts.chainlinkManager,
      constructorArguments: [
        contracts.tslaOracle,
        contracts.aaplOracle,
        contracts.marketStatusOracle
      ]
    },
    {
      name: "LiquidityPool",
      address: contracts.liquidityPool,
      constructorArguments: [contracts.usdc]
    },
    {
      name: "Vault",
      address: contracts.vault,
      constructorArguments: [
        contracts.usdc,
        deployment.deployer,
        contracts.chainlinkManager
      ]
    },
    {
      name: "PerpEngine",
      address: contracts.perpEngine,
      constructorArguments: [
        contracts.usdc,
        contracts.liquidityPool,
        contracts.chainlinkManager,
        contracts.vault
      ]
    },
    {
      name: "sTSLA",
      address: contracts.sTSLA,
      constructorArguments: []
    },
    {
      name: "sAPPL",
      address: contracts.sAPPL,
      constructorArguments: []
    }
  ];

  // Verify each contract
  for (const config of verifyConfigs) {
    console.log(`\nVerifying ${config.name} at ${config.address}...`);
    
    try {
      await run("verify:verify", {
        address: config.address,
        constructorArguments: config.constructorArguments,
      });
      console.log(`✅ ${config.name} verified successfully`);
    } catch (error) {
      if (error.message.includes("Already Verified")) {
        console.log(`✓ ${config.name} already verified`);
      } else {
        console.error(`❌ Failed to verify ${config.name}:`, error.message);
      }
    }
  }

  console.log("\n✨ Verification complete!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });