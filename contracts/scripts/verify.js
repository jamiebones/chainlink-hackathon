const { run } = require("hardhat");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const NETWORK_CONFIGS = {
  sepolia: {
    router: "0xb83E47C2bC239B3bf370bc41e1459A34b41238D0",
    donId: "0x66756e2d657468657265756d2d7365706f6c69612d3100000000000000000000",
    gasLimit: 300000
  },
  arbitrumSepolia: {
    router: "0x234a5fb5Bd614a7AA2FfAB244D603abFA0Ac5C5C",
    donId: "0x66756e2d617262697472756d2d7365706f6c69612d3100000000000000000000",
    gasLimit: 300000
  },
  arbitrum: {
    router: "0x97083e831f8f0638855e2a515c90edcf158df238",
    donId: "0x66756e2d617262697472756d2d6d61696e6e65742d3100000000000000000000",
    gasLimit: 300000
  },
  mainnet: {
    router: "0x65Dcc24F8ff9e51F10DCc7Ed1e4e2A61e6E14bd6",
    donId: "0x66756e2d657468657265756d2d6d61696e6e65742d3100000000000000000000",
    gasLimit: 300000
  },
  fuji: {
    router: "0xA9d587a00A31A52Ed70D6026794a8FC5E2F5dCb0",
    donId: "0x66756e2d6176616c616e6368652d66756a692d31000000000000000000000000",
    gasLimit: 300000
  }
};

async function main() {
  console.log("Starting contract verification...\n");

  // Load deployment info
    const networkInfo = await ethers.provider.getNetwork();
  const networkName = network.name;
  console.log(`Network: ${networkName} (Chain ID: ${networkInfo.chainId})`);
  
  // Get network config from hardcoded configs
  const networkConfig = NETWORK_CONFIGS[networkName];
  if (!networkConfig) {
    console.error(`❌ Network ${networkName} not supported`);
    console.error(`Supported networks: ${Object.keys(NETWORK_CONFIGS).join(', ')}`);
    process.exit(1);
  }
  
  const { router, donId, gasLimit } = networkConfig;
  const oracleWindowSize = 60;
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
      constructorArguments: [
        oracleWindowSize, 
        contracts.marketStatusOracle,
        router,
        donId,
        gasLimit
      ]
    },
    {
      name: "AAPLOracleManager", 
      address: contracts.aaplOracle,
      constructorArguments: [
        oracleWindowSize,
        router,
        donId,
        gasLimit]
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
        contracts.vault,
        deployment.configuration.feeReceiver
      ]
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