const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function analyzePositionHistory() {
  console.log("🔍 Position History and Issue Analyzer...\n");

  const deploymentPath = path.join(__dirname, "../deployments/fuji_deployment.json");
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
  const perpEngine = await ethers.getContractAt("PerpEngine", deployment.contracts.perpEngine);
  
  const [deployer] = await ethers.getSigners();
  const asset = 0; // TSLA

  // ================================================================
  // STEP 1: GET EXACT POSITION DATA
  // ================================================================
  
  console.log("📋 === EXACT POSITION DATA ===");
  
  let position;
  try {
    position = await perpEngine.getPosition(deployer.address, asset);
    
    console.log(`Position Size: ${ethers.formatUnits(position.sizeUsd, 6)} USD`);
    console.log(`Collateral: ${ethers.formatUnits(position.collateral, 6)} USDC`);
    console.log(`Entry Price: ${ethers.formatUnits(position.entryPrice, 18)}`);
    console.log(`Is Long: ${position.isLong}`);
    console.log(`Entry Funding Rate: ${ethers.formatUnits(position.entryFundingRate, 18)}`);
    
    // The critical timestamp
    const borrowingTimestamp = Number(position.lastBorrowingUpdate);
    const borrowingDate = new Date(borrowingTimestamp * 1000);
    
    console.log(`\n🕐 Critical Timestamp Data:`);
    console.log(`lastBorrowingUpdate: ${borrowingTimestamp}`);
    console.log(`Position Opened: ${borrowingDate.toISOString()}`);
    console.log(`Readable Date: ${borrowingDate.toString()}`);
    
  } catch (error) {
    console.log(`❌ Failed to get position: ${error.message}`);
    return;
  }

  // ================================================================
  // STEP 2: TRACE POSITION OPENING TRANSACTION
  // ================================================================
  
  console.log("\n🔍 === TRACING POSITION OPENING ===");
  
  try {
    // Look for PositionOpened events
    console.log("Searching for PositionOpened events...");
    
    // Get events from recent blocks (last 10000 blocks)
    const currentBlock = await ethers.provider.getBlockNumber();
    const fromBlock = Math.max(0, currentBlock - 10000);
    
    const filter = perpEngine.filters.PositionOpened(deployer.address, asset);
    const events = await perpEngine.queryFilter(filter, fromBlock, currentBlock);
    
    console.log(`Found ${events.length} PositionOpened events for this user/asset`);
    
    if (events.length > 0) {
      const latestEvent = events[events.length - 1]; // Most recent
      const block = await ethers.provider.getBlock(latestEvent.blockNumber);
      
      console.log(`\n📅 Position Opening Transaction:`);
      console.log(`Block Number: ${latestEvent.blockNumber}`);
      console.log(`Transaction Hash: ${latestEvent.transactionHash}`);
      console.log(`Block Timestamp: ${block.timestamp} (${new Date(block.timestamp * 1000).toISOString()})`);
      console.log(`Event Args:`, {
        trader: latestEvent.args.trader,
        asset: Number(latestEvent.args.asset),
        sizeUsd: ethers.formatUnits(latestEvent.args.sizeUsd, 6),
        collateralAmount: ethers.formatUnits(latestEvent.args.collateralAmount, 6),
        price: ethers.formatUnits(latestEvent.args.price, 18),
        isLong: latestEvent.args.isLong
      });
      
      // Compare block timestamp with position timestamp
      const blockTime = block.timestamp;
      const positionTime = Number(position.lastBorrowingUpdate);
      
      console.log(`\n🔍 Timestamp Comparison:`);
      console.log(`Block Timestamp: ${blockTime} (${new Date(blockTime * 1000).toISOString()})`);
      console.log(`Position Timestamp: ${positionTime} (${new Date(positionTime * 1000).toISOString()})`);
      console.log(`Difference: ${Math.abs(blockTime - positionTime)} seconds`);
      
      if (Math.abs(blockTime - positionTime) > 60) {
        console.log("⚠️  WARNING: Significant difference between block time and position timestamp!");
      } else {
        console.log("✅ Timestamps match - position was set correctly");
      }
      
    } else {
      console.log("❌ No PositionOpened events found in recent blocks");
      console.log("This suggests the position is very old or opened on different network");
    }
    
  } catch (error) {
    console.log(`❌ Event tracing failed: ${error.message}`);
  }

  // ================================================================
  // STEP 3: CURRENT TIME ANALYSIS
  // ================================================================
  
  console.log("\n⏰ === CURRENT TIME ANALYSIS ===");
  
  try {
    const currentBlock = await ethers.provider.getBlock('latest');
    const networkTime = currentBlock.timestamp;
    const realTime = Math.floor(Date.now() / 1000);
    const positionTime = Number(position.lastBorrowingUpdate);
    
    console.log(`Real Time: ${realTime} (${new Date(realTime * 1000).toISOString()})`);
    console.log(`Network Time: ${networkTime} (${new Date(networkTime * 1000).toISOString()})`);
    console.log(`Position Time: ${positionTime} (${new Date(positionTime * 1000).toISOString()})`);
    
    const elapsedFromPosition = networkTime - positionTime;
    const elapsedFromReal = realTime - positionTime;
    
    console.log(`\n📊 Time Elapsed Calculations:`);
    console.log(`Network - Position: ${elapsedFromPosition} seconds (${(elapsedFromPosition / 3600).toFixed(2)} hours)`);
    console.log(`Real - Position: ${elapsedFromReal} seconds (${(elapsedFromReal / 3600).toFixed(2)} hours)`);
    console.log(`Days Elapsed: ${(elapsedFromPosition / (24 * 3600)).toFixed(2)} days`);
    
    // Check for abnormal time differences
    if (elapsedFromPosition > (365 * 24 * 3600)) {
      console.log("🚨 CRITICAL: Position appears to be over 1 year old!");
    } else if (elapsedFromPosition > (30 * 24 * 3600)) {
      console.log("⚠️  WARNING: Position is over 1 month old");
    } else if (elapsedFromPosition > (7 * 24 * 3600)) {
      console.log("⚠️  Position is over 1 week old");
    } else {
      console.log("✅ Position age appears reasonable");
    }
    
  } catch (error) {
    console.log(`❌ Time analysis failed: ${error.message}`);
  }

  // ================================================================
  // STEP 4: IDENTIFY THE EXACT ISSUE
  // ================================================================
  
  console.log("\n🎯 === ISSUE IDENTIFICATION ===");
  
  try {
    const positionTime = Number(position.lastBorrowingUpdate);
    const currentTime = Math.floor(Date.now() / 1000);
    
    // Check common scenarios
    console.log("Checking common scenarios...");
    
    // Scenario 1: Very old timestamp (before 2020)
    if (positionTime < 1577836800) { // Jan 1, 2020
      console.log("🚨 SCENARIO 1: Timestamp is from before 2020");
      console.log("Likely cause: Contract bug or initialization issue");
    }
    // Scenario 2: Position opened in early 2024 or earlier
    else if (positionTime < 1704067200) { // Jan 1, 2024
      console.log("🚨 SCENARIO 2: Position opened before 2024");
      console.log("Likely cause: Old test position left running");
    }
    // Scenario 3: Position opened more than 30 days ago
    else if ((currentTime - positionTime) > (30 * 24 * 3600)) {
      console.log("⚠️  SCENARIO 3: Position over 30 days old");
      console.log("Likely cause: Forgotten test position");
    }
    // Scenario 4: Recent position but network time issues
    else if ((currentTime - positionTime) < (24 * 3600)) {
      console.log("🤔 SCENARIO 4: Recent position with time calculation issues");
      console.log("Likely cause: Network time manipulation or calculation bug");
    }
    
    // Calculate exact borrowing fee that would be applied
    const borrowingRateAnnual = await perpEngine.borrowingRateAnnualBps();
    const networkBlock = await ethers.provider.getBlock('latest');
    const networkTime = networkBlock.timestamp;
    const elapsed = networkTime - positionTime;
    
    const borrowingFee = position.sizeUsd * borrowingRateAnnual * BigInt(elapsed) / (365n * 24n * 3600n) / 10000n;
    
    console.log(`\n💰 Exact Fee Calculation:`);
    console.log(`Position: ${ethers.formatUnits(position.sizeUsd, 6)} USD`);
    console.log(`Rate: ${borrowingRateAnnual} bps (${Number(borrowingRateAnnual) / 100}% annually)`);
    console.log(`Elapsed: ${elapsed} seconds`);
    console.log(`Fee: ${ethers.formatUnits(borrowingFee, 6)} USDC`);
    console.log(`Collateral: ${ethers.formatUnits(position.collateral, 6)} USDC`);
    console.log(`Exceeds Collateral: ${borrowingFee >= position.collateral ? "YES" : "NO"}`);
    
  } catch (error) {
    console.log(`❌ Issue identification failed: ${error.message}`);
  }

  // ================================================================
  // STEP 5: SPECIFIC SOLUTIONS
  // ================================================================
  
  console.log("\n💡 === SPECIFIC SOLUTIONS ===");
  
  const positionTime = Number(position.lastBorrowingUpdate);
  const currentTime = Math.floor(Date.now() / 1000);
  const elapsed = currentTime - positionTime;
  
  if (elapsed > (365 * 24 * 3600)) {
    console.log("🚨 URGENT: Extremely old position detected");
    console.log("Solutions:");
    console.log("1. Add massive collateral (2000+ USDC) immediately");
    console.log("2. Close position ASAP");
    console.log("3. This suggests a development/testing environment issue");
  } else if (elapsed > (30 * 24 * 3600)) {
    console.log("⚠️  OLD: Position over 1 month old");
    console.log("Solutions:");
    console.log("1. Add substantial collateral (500+ USDC)");
    console.log("2. Close position to stop fee bleeding");
  } else {
    console.log("✅ Position age is manageable");
    console.log("Solutions:");
    console.log("1. Add moderate collateral (100+ USDC)");
    console.log("2. Consider closing if not actively trading");
  }

  console.log(`\n🛠️  Emergency Commands:`);
  console.log(`# Add collateral:`);
  console.log(`await perpEngine.addCollateral(${asset}, ethers.parseUnits("2000", 6));`);
  console.log(`# Close position:`);
  console.log(`await perpEngine.closePosition(${asset});`);

  console.log("\n✨ Analysis complete!");
}

// Helper function to show exact fee calculation step by step
async function detailedFeeCalculation() {
  console.log("🧮 Detailed Fee Calculation...\n");
  
  const deploymentPath = path.join(__dirname, "../deployments/sepolia_deployment.json");
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
  const perpEngine = await ethers.getContractAt("PerpEngine", deployment.contracts.perpEngine);
  
  const [deployer] = await ethers.getSigners();
  const asset = 0;
  
  try {
    const position = await perpEngine.getPosition(deployer.address, asset);
    const borrowingRateAnnual = await perpEngine.borrowingRateAnnualBps();
    const currentBlock = await ethers.provider.getBlock('latest');
    
    const sizeUsd = position.sizeUsd;
    const rate = borrowingRateAnnual;
    const elapsed = BigInt(currentBlock.timestamp - Number(position.lastBorrowingUpdate));
    
    console.log("📋 Step-by-step calculation (matching contract exactly):");
    console.log(`1. sizeUsd = ${ethers.formatUnits(sizeUsd, 6)} USD`);
    console.log(`2. borrowingRateAnnualBps = ${rate} bps`);
    console.log(`3. elapsed = ${elapsed} seconds`);
    console.log(`4. numerator = sizeUsd * rate * elapsed`);
    console.log(`   = ${sizeUsd} * ${rate} * ${elapsed}`);
    console.log(`   = ${sizeUsd * rate * elapsed}`);
    console.log(`5. denominator = 365 * 24 * 3600 * 10000`);
    console.log(`   = ${365n * 24n * 3600n * 10000n}`);
    console.log(`6. fee = numerator / denominator`);
    
    const fee = (sizeUsd * rate * elapsed) / (365n * 24n * 3600n * 10000n);
    console.log(`   = ${fee} (raw)`);
    console.log(`   = ${ethers.formatUnits(fee, 6)} USDC`);
    
    console.log(`\n💰 Result:`);
    console.log(`Borrowing fee: ${ethers.formatUnits(fee, 6)} USDC`);
    console.log(`Position collateral: ${ethers.formatUnits(position.collateral, 6)} USDC`);
    console.log(`Would revert: ${fee >= position.collateral ? "YES" : "NO"}`);
    
  } catch (error) {
    console.log(`❌ Detailed calculation failed: ${error.message}`);
  }
}

module.exports = {
  analyzePositionHistory,
  detailedFeeCalculation
};

analyzePositionHistory()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Analysis failed:", error);
    process.exit(1);
  });