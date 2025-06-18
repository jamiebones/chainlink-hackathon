const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function testOracleSetup() {
  console.log("🧪 Testing Oracle Setup on Sepolia...\n");

  // Load deployment
  const deploymentPath = path.join(__dirname, "../deployments/sepolia_deployment.json");
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
  const contracts = deployment.contracts;

  const [deployer] = await ethers.getSigners();
  console.log(`Testing with account: ${deployer.address}\n`);

  // === STEP 1: UPDATE THIS WITH YOUR SUBSCRIPTION ID ===
  const SUBSCRIPTION_ID = 5017; // ⚠️ REPLACE WITH YOUR ACTUAL SUBSCRIPTION ID
  
  if (SUBSCRIPTION_ID === 0) {
    console.log("❌ Please update SUBSCRIPTION_ID in this script first!");
    console.log("Get it from https://functions.chain.link/ after creating subscription");
    return;
  }

  console.log(`Using Subscription ID: ${SUBSCRIPTION_ID}\n`);

  // Get contract instances
  const tslaOracle = await ethers.getContractAt("TSLAOracleManager", contracts.tslaOracle);
  const marketOracle = await ethers.getContractAt("MarketStatusOracle", contracts.marketStatusOracle);
  const chainlinkManager = await ethers.getContractAt("ChainlinkManager", contracts.chainlinkManager);

  // Step 1: Check current prices (should be 0)
  console.log("📊 Current Oracle Status:");
  try {
    const tslaPrice = await chainlinkManager.getPrice(0);
    const tslaRaw = await tslaOracle.getPriceTSLA();
    console.log(`TSLA Price: ${ethers.formatUnits(tslaPrice, 18)} (raw: ${tslaRaw})`);
    
    const marketOpen = await chainlinkManager.isMarketOpen();
    console.log(`Market Open: ${marketOpen}\n`);
  } catch (error) {
    console.log(`❌ Error reading current prices: ${error.message}\n`);
  }

  // Step 2: Send oracle update requests
  console.log("📡 Sending Oracle Update Requests...");
  
  try {
    // Update TSLA price
    console.log("Requesting TSLA price update...");
    const tslaTx = await tslaOracle.sendRequest(SUBSCRIPTION_ID, {
      gasLimit: 500000 // Higher gas limit for Chainlink Functions
    });
    console.log(`TSLA request sent: ${tslaTx.hash}`);
    await tslaTx.wait();
    console.log("✅ TSLA request confirmed\n");

    // Update market status
    console.log("Requesting market status update...");
    const marketTx = await marketOracle.sendRequest(SUBSCRIPTION_ID, {
      gasLimit: 500000
    });
    console.log(`Market request sent: ${marketTx.hash}`);
    await marketTx.wait();
    console.log("✅ Market request confirmed\n");

  } catch (error) {
    console.log(`❌ Failed to send requests: ${error.message}`);
    
    // Common error diagnostics
    if (error.message.includes("InvalidSubscription")) {
      console.log("💡 Your subscription doesn't exist or is invalid");
    } else if (error.message.includes("InvalidConsumer")) {
      console.log("💡 Your oracle contracts aren't added as consumers");
      console.log("   Add them at https://functions.chain.link/");
    } else if (error.message.includes("InsufficientBalance")) {
      console.log("💡 Your subscription needs more LINK tokens");
    } else if (error.message.includes("EmptySource")) {
      console.log("💡 JavaScript source code issue");
    }
    return;
  }

  // Step 3: Wait and check for updates
  console.log("⏳ Waiting for Chainlink Functions to respond...");
  console.log("This typically takes 1-3 minutes.\n");

  // Check periodically for updates
  for (let i = 0; i < 20; i++) { // Check for 10 minutes
    await new Promise(resolve => setTimeout(resolve, 30000)); // Wait 30 seconds
    
    try {
      const tslaPrice = await chainlinkManager.getPrice(0);
      const tslaRaw = await tslaOracle.getPriceTSLA();
      
      console.log(`Check ${i + 1}: TSLA raw price = ${tslaRaw}`);
      
      if (tslaRaw > 0) {
        console.log("🎉 SUCCESS! Oracle received price data:");
        console.log(`TSLA Price: ${ethers.formatUnits(tslaPrice, 18)}`);
        console.log(`Raw price: ${tslaRaw} (this represents $${tslaRaw / 100})`);
        
        const marketOpen = await chainlinkManager.isMarketOpen();
        console.log(`Market Open: ${marketOpen}`);
        
        console.log("\n✅ Oracles are working! You can now test trading functions.");
        return;
      }
    } catch (error) {
      console.log(`Check ${i + 1}: Error - ${error.message}`);
    }
  }
  
  console.log("⚠️ Oracles haven't updated yet. This could mean:");
  console.log("1. The API requests are still processing (wait longer)");
  console.log("2. The external APIs are down");
  console.log("3. There's an issue with the subscription setup");
  console.log("4. The JavaScript code has an error");
}

// Function to just check oracle status without sending requests
async function checkOracleStatus() {
  console.log("📊 Checking Current Oracle Status...\n");

  const deploymentPath = path.join(__dirname, "../deployments/sepolia_deployment.json");
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
  const contracts = deployment.contracts;

  const chainlinkManager = await ethers.getContractAt("ChainlinkManager", contracts.chainlinkManager);
  const tslaOracle = await ethers.getContractAt("TSLAOracleManager", contracts.tslaOracle);

  try {
    const tslaPrice = await chainlinkManager.getPrice(0);
    const tslaRaw = await tslaOracle.getPriceTSLA();
    const aaplPrice = await chainlinkManager.getPrice(1);
    const marketOpen = await chainlinkManager.isMarketOpen();
    const tslaPaused = await chainlinkManager.checkIfAssetIsPaused(0);

    console.log(`TSLA Price: ${ethers.formatUnits(tslaPrice, 18)} (raw: ${tslaRaw})`);
    console.log(`AAPL Price: ${ethers.formatUnits(aaplPrice, 18)}`);
    console.log(`Market Open: ${marketOpen}`);
    console.log(`TSLA Paused: ${tslaPaused}`);

    if (tslaPrice > 0 && aaplPrice > 0) {
      console.log("\n✅ All oracles have valid prices! Ready for trading.");
    } else {
      console.log("\n❌ Some oracles still returning zero prices.");
    }

  } catch (error) {
    console.log(`❌ Error checking status: ${error.message}`);
  }
}

// Main execution
async function main() {
  const action = process.argv[2];
  
  if (action === "check") {
    await checkOracleStatus();
  } else {
    await testOracleSetup();
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });