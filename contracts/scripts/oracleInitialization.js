const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function initializeOracles() {
  console.log("🔮 Initializing Oracle Prices on Sepolia...\n");

  // Load deployment
  const deploymentPath = path.join(__dirname, "../deployments/sepolia_deployment.json");
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
  const contracts = deployment.contracts;

  const [deployer] = await ethers.getSigners();

  // Get oracle contracts
  const tslaOracle = await ethers.getContractAt("TSLAOracleManager", contracts.tslaOracle);
  const aaplOracle = await ethers.getContractAt("AAPLOracleManager", contracts.aaplOracle);
  const marketOracle = await ethers.getContractAt("MarketStatusOracle", contracts.marketStatusOracle);

  console.log("📋 Oracle Addresses:");
  console.log(`TSLA Oracle: ${contracts.tslaOracle}`);
  console.log(`AAPL Oracle: ${contracts.aaplOracle}`);
  console.log(`Market Oracle: ${contracts.marketStatusOracle}\n`);

  // IMPORTANT: You need to create a Chainlink Functions subscription first
  // Go to https://functions.chain.link/ and create a subscription for Sepolia
  const SUBSCRIPTION_ID = 0; // REPLACE WITH YOUR ACTUAL SUBSCRIPTION ID

  if (SUBSCRIPTION_ID === 0) {
    console.log("❌ CRITICAL: You need to set up Chainlink Functions subscription!");
    console.log("1. Go to https://functions.chain.link/");
    console.log("2. Connect wallet and switch to Sepolia");
    console.log("3. Create a new subscription");
    console.log("4. Fund it with LINK tokens (get from faucet)");
    console.log("5. Add your oracle contract addresses as consumers");
    console.log("6. Update SUBSCRIPTION_ID in this script");
    return;
  }

  try {
    // Send requests to update oracle prices
    console.log("📡 Sending oracle update requests...");

    // Update TSLA price
    console.log("Updating TSLA price...");
    const tslaTx = await tslaOracle.sendRequest(SUBSCRIPTION_ID);
    await tslaTx.wait();
    console.log(`✅ TSLA request sent: ${tslaTx.hash}`);

    // Update AAPL price
    console.log("Updating AAPL price...");
    const aaplTx = await aaplOracle.sendRequest(SUBSCRIPTION_ID);
    await aaplTx.wait();
    console.log(`✅ AAPL request sent: ${aaplTx.hash}`);

    // Update market status
    console.log("Updating market status...");
    const marketTx = await marketOracle.sendRequest(SUBSCRIPTION_ID);
    await marketTx.wait();
    console.log(`✅ Market status request sent: ${marketTx.hash}`);

    console.log("\n⏳ Waiting for Chainlink Functions to fulfill requests...");
    console.log("This may take 1-3 minutes. Check back or run the check script.");

  } catch (error) {
    console.error(`❌ Failed to send oracle requests: ${error.message}`);
    
    if (error.message.includes("InvalidSubscription")) {
      console.log("💡 Your subscription ID is invalid or doesn't exist");
    } else if (error.message.includes("InvalidConsumer")) {
      console.log("💡 Your oracle contracts aren't added as consumers to the subscription");
    } else if (error.message.includes("InsufficientBalance")) {
      console.log("💡 Your subscription needs more LINK tokens");
    }
  }
}

// Function to check oracle status
async function checkOracleStatus() {
  console.log("🔍 Checking Oracle Status...\n");

  const deploymentPath = path.join(__dirname, "../deployments/sepolia_deployment.json");
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
  const contracts = deployment.contracts;

  const tslaOracle = await ethers.getContractAt("TSLAOracleManager", contracts.tslaOracle);
  const aaplOracle = await ethers.getContractAt("AAPLOracleManager", contracts.aaplOracle);
  const chainlinkManager = await ethers.getContractAt("ChainlinkManager", contracts.chainlinkManager);

  try {
    // Check raw oracle prices
    const tslaRawPrice = await tslaOracle.getPriceTSLA();
    const aaplRawPrice = await aaplOracle.getPriceAAPL();
    
    console.log(`TSLA raw price: ${tslaRawPrice} (should be > 0)`);
    console.log(`AAPL raw price: ${aaplRawPrice} (should be > 0)`);

    // Check ChainlinkManager prices (scaled)
    const tslaPrice = await chainlinkManager.getPrice(0);
    const aaplPrice = await chainlinkManager.getPrice(1);
    
    console.log(`TSLA scaled price: ${ethers.formatUnits(tslaPrice, 18)}`);
    console.log(`AAPL scaled price: ${ethers.formatUnits(aaplPrice, 18)}`);

    // Check if paused
    const tslaPaused = await chainlinkManager.checkIfAssetIsPaused(0);
    const aaplPaused = await chainlinkManager.checkIfAssetIsPaused(1);
    
    console.log(`TSLA paused: ${tslaPaused}`);
    console.log(`AAPL paused: ${aaplPaused}`);

    if (tslaPrice > 0 && aaplPrice > 0) {
      console.log("\n✅ Oracles are working! You can now try opening positions.");
    } else {
      console.log("\n❌ Oracles still returning zero. Wait longer or check subscription.");
    }

  } catch (error) {
    console.error(`❌ Oracle check failed: ${error.message}`);
  }
}

// Main function
async function main() {
  const action = process.argv[2];
  
  if (action === "check") {
    await checkOracleStatus();
  } else {
    await initializeOracles();
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });