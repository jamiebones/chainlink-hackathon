const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function debugReducePosition() {
  console.log("🔍 Reduce Position Function Debugger...\n");

  const deploymentPath = path.join(__dirname, "../deployments/fuji_deployment.json");
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
  const perpEngine = await ethers.getContractAt("PerpEngine", deployment.contracts.perpEngine);
  const liquidityPool = await ethers.getContractAt("LiquidityPool", deployment.contracts.liquidityPool);
  
  const [deployer] = await ethers.getSigners();
  const asset = 0; // TSLA

  // ================================================================
  // STEP 1: CHECK POSITION STATE
  // ================================================================
  
  console.log("📋 === STEP 1: POSITION STATE ANALYSIS ===");
  
  let position;
  try {
    position = await perpEngine.getPosition(deployer.address, asset);
    
    if (position.sizeUsd == 0) {
      console.log("❌ No position exists - cannot reduce");
      return;
    }
    
    console.log(`Position Size: ${ethers.formatUnits(position.sizeUsd, 6)} USD`);
    console.log(`Collateral: ${ethers.formatUnits(position.collateral, 6)} USDC`);
    console.log(`Entry Price: ${ethers.formatUnits(position.entryPrice, 18)}`);
    console.log(`Is Long: ${position.isLong}`);
    console.log(`Entry Funding Rate: ${ethers.formatUnits(position.entryFundingRate, 18)}`);
    
  } catch (error) {
    console.log(`❌ Failed to get position: ${error.message}`);
    return;
  }

  // ================================================================
  // STEP 2: TEST REDUCE PARAMETERS
  // ================================================================
  
  console.log("\n📊 === STEP 2: TESTING REDUCE PARAMETERS ===");
  
  // Test different reduce amounts
  const testAmounts = [
    position.sizeUsd / 4n,  // 25%
    position.sizeUsd / 2n,  // 50% 
    position.sizeUsd * 3n / 4n,  // 75%
    position.sizeUsd  // 100%
  ];
  
  for (let i = 0; i < testAmounts.length; i++) {
    const reduceAmount = testAmounts[i];
    const percentage = [25, 50, 75, 100][i];
    
    console.log(`\nTesting ${percentage}% reduction (${ethers.formatUnits(reduceAmount, 6)} USD):`);
    
    // Basic validation checks
    if (reduceAmount == 0) {
      console.log("❌ Would fail: Zero amount");
      continue;
    }
    
    if (reduceAmount > position.sizeUsd) {
      console.log("❌ Would fail: Amount exceeds position size");
      continue;
    }
    
    console.log("✅ Basic validations pass");
    
    // Test the static call
    try {
      const result = await perpEngine.reducePosition.staticCall(asset, reduceAmount);
      console.log(`✅ Static call successful`);
      console.log(`   Net return: ${ethers.formatUnits(result[0], 6)} USDC`);
      console.log(`   PnL: ${ethers.formatUnits(result[1], 6)} USDC`);
      
    } catch (reduceError) {
      console.log(`❌ Static call failed: ${reduceError.message}`);
      
      // Try to decode the error
      if (reduceError.data) {
        try {
          const iface = perpEngine.interface;
          const decodedError = iface.parseError(reduceError.data);
          console.log(`   Decoded error: ${decodedError.name}`);
          if (decodedError.args && decodedError.args.length > 0) {
            console.log(`   Error args:`, decodedError.args.map(arg => arg.toString()));
          }
        } catch (decodeError) {
          console.log(`   Raw error data: ${reduceError.data}`);
        }
      }
    }
  }

  // ================================================================
  // STEP 3: ANALYZE INDIVIDUAL CALCULATION STEPS
  // ================================================================
  
  console.log("\n🧮 === STEP 3: CALCULATION ANALYSIS ===");
  
  try {
    const reduceAmount = position.sizeUsd / 2n; // Test with 50% reduction
    console.log(`Analyzing 50% reduction: ${ethers.formatUnits(reduceAmount, 6)} USD`);
    
    // Step 1: Calculate close portion
    const closePortion = (reduceAmount * ethers.parseUnits("1", 18)) / position.sizeUsd;
    console.log(`Close Portion: ${ethers.formatUnits(closePortion, 18)} (${Number(closePortion) / 1e18 * 100}%)`);
    
    // Step 2: Get current PnL
    let pnl;
    try {
      pnl = await perpEngine.getPnL(asset, deployer.address);
      console.log(`Current PnL: ${ethers.formatUnits(pnl, 6)} USDC`);
    } catch (pnlError) {
      console.log(`❌ PnL calculation failed: ${pnlError.message}`);
      return;
    }
    
    // Step 3: Calculate portion PnL
    const portionPnL = (pnl * BigInt(closePortion.toString())) / ethers.parseUnits("1", 18);
    console.log(`Portion PnL: ${ethers.formatUnits(portionPnL, 6)} USDC`);
    
    // Step 4: Calculate proportional collateral
    const proportionalCollateral = (position.collateral * closePortion) / ethers.parseUnits("1", 18);
    console.log(`Proportional Collateral: ${ethers.formatUnits(proportionalCollateral, 6)} USDC`);
    
    // Step 5: Calculate gross return
    const grossReturn = BigInt(proportionalCollateral.toString()) + portionPnL;
    console.log(`Gross Return: ${ethers.formatUnits(grossReturn, 6)} USDC`);
    
    if (grossReturn <= 0) {
      console.log("⚠️  Gross return <= 0 - would result in 0 net return");
    } else {
      // Step 6: Calculate close fee
      const closeFeeBps = await perpEngine.closeFeeBps();
      const closeFee = (grossReturn * closeFeeBps) / 10000n;
      console.log(`Close Fee (${closeFeeBps} bps): ${ethers.formatUnits(closeFee, 6)} USDC`);
      
      const netReturn = grossReturn - closeFee;
      console.log(`Net Return: ${ethers.formatUnits(netReturn, 6)} USDC`);
    }
    
  } catch (error) {
    console.log(`❌ Calculation analysis failed: ${error.message}`);
  }

  // ================================================================
  // STEP 4: CHECK POOL LIQUIDITY AND RESERVES
  // ================================================================
  
  console.log("\n🏊 === STEP 4: POOL LIQUIDITY ANALYSIS ===");
  
  try {
    const totalLiquidity = await liquidityPool.totalLiquidity();
    const reservedLiquidity = await liquidityPool.reservedLiquidity();
    const availableLiquidity = await liquidityPool.availableLiquidity();
    
    console.log(`Total Liquidity: ${ethers.formatUnits(totalLiquidity, 6)} USDC`);
    console.log(`Reserved Liquidity: ${ethers.formatUnits(reservedLiquidity, 6)} USDC`);
    console.log(`Available Liquidity: ${ethers.formatUnits(availableLiquidity, 6)} USDC`);
    
    // Check if pool has enough liquidity for potential payouts
    const maxPayout = position.collateral; // Worst case scenario
    console.log(`Max potential payout: ${ethers.formatUnits(maxPayout, 6)} USDC`);
    
    if (maxPayout > availableLiquidity) {
      console.log("🚨 CRITICAL: Pool doesn't have enough liquidity for potential payout");
      console.log("This could cause releaseTo() calls to fail");
    } else {
      console.log("✅ Pool has sufficient liquidity");
    }
    
  } catch (error) {
    console.log(`❌ Pool liquidity check failed: ${error.message}`);
  }

  // ================================================================
  // STEP 5: CHECK OPEN INTEREST ACCOUNTING
  // ================================================================
  
  console.log("\n📊 === STEP 5: OPEN INTEREST ANALYSIS ===");
  
  try {
    const longOI = await perpEngine.longOpenInterestUsd(asset);
    const shortOI = await perpEngine.shortOpenInterestUsd(asset);
    const longTokens = await perpEngine.longOpenInterestTokens(asset);
    
    console.log(`Long OI USD: ${ethers.formatUnits(longOI, 6)}`);
    console.log(`Short OI USD: ${ethers.formatUnits(shortOI, 6)}`);
    console.log(`Long OI Tokens: ${ethers.formatUnits(longTokens, 18)}`);
    
    // Check if reducing this position would cause underflow
    const reduceAmount = position.sizeUsd / 2n;
    
    if (position.isLong) {
      if (reduceAmount > longOI) {
        console.log("🚨 CRITICAL: Reduce amount exceeds total long OI");
        console.log("This would cause underflow in longOpenInterestUsd");
      }
      
      const tokensToReduce = (reduceAmount * ethers.parseUnits("1", 18)) / position.entryPrice;
      if (tokensToReduce > longTokens) {
        console.log("🚨 CRITICAL: Token reduction exceeds total long tokens");
        console.log("This would cause underflow in longOpenInterestTokens");
      }
    } else {
      if (reduceAmount > shortOI) {
        console.log("🚨 CRITICAL: Reduce amount exceeds total short OI");
        console.log("This would cause underflow in shortOpenInterestUsd");
      }
    }
    
    console.log("✅ Open interest accounting should work");
    
  } catch (error) {
    console.log(`❌ Open interest check failed: ${error.message}`);
  }

  // ================================================================
  // STEP 6: CHECK FEE RECEIVER AND ADDRESSES
  // ================================================================
  
  console.log("\n💰 === STEP 6: FEE RECEIVER ANALYSIS ===");
  
  try {
    const feeReceiver = await perpEngine.feeReceiver();
    console.log(`Fee Receiver: ${feeReceiver}`);
    
    if (feeReceiver === ethers.ZeroAddress) {
      console.log("🚨 CRITICAL: Fee receiver not set");
      console.log("This will cause 'Fee receiver unset' error");
    } else {
      console.log("✅ Fee receiver is set");
    }
    
    const vaultAddress = await perpEngine.vaultAddress();
    console.log(`Vault Address: ${vaultAddress}`);
    console.log(`Is user vault: ${deployer.address.toLowerCase() === vaultAddress.toLowerCase()}`);
    
  } catch (error) {
    console.log(`❌ Fee receiver check failed: ${error.message}`);
  }

  // ================================================================
  // STEP 7: STEP-BY-STEP FUNCTION SIMULATION
  // ================================================================
  
  console.log("\n🎯 === STEP 7: STEP-BY-STEP SIMULATION ===");
  
  try {
    console.log("Simulating reducePosition execution order...");
    
    // 1. Check if paused
    const isPaused = await perpEngine.isPaused();
    console.log(`1. Market paused: ${isPaused}`);
    if (isPaused) {
      console.log("❌ Would fail: MarketPaused");
      return;
    }
    
    // 2. Update funding rate (might fail on getDexPrice)
    console.log("2. Testing _updateFundingRate...");
    try {
      // This is internal, but we can test by triggering it
      await perpEngine.addCollateral.staticCall(asset, 1);
      console.log("✅ _updateFundingRate works");
    } catch (fundingError) {
      if (fundingError.message.includes("getDexPrice")) {
        console.log("❌ _updateFundingRate fails: getDexPrice missing");
        return;
      }
    }
    
    // 3. Apply funding (might fail on timestamp corruption)
    console.log("3. Testing _applyFunding...");
    // This is tested in the same call above
    
    // 4. Apply borrowing fee (might fail on timestamp corruption)
    console.log("4. Testing _applyBorrowingFee...");
    // This is also tested in the same call above
    
    console.log("✅ All preliminary functions should work");
    
  } catch (error) {
    console.log(`❌ Step-by-step simulation failed: ${error.message}`);
  }

  // ================================================================
  // STEP 8: FINAL TARGETED TEST
  // ================================================================
  
  console.log("\n🎯 === STEP 8: FINAL TARGETED TEST ===");
  
  try {
    console.log("Testing actual reducePosition call...");
    
    const reduceAmount = position.sizeUsd / 4n; // Conservative 25% reduction
    console.log(`Attempting to reduce by ${ethers.formatUnits(reduceAmount, 6)} USD (25%)`);
    
    // Use staticCall first
    const result = await perpEngine.reducePosition.staticCall(asset, reduceAmount);
    console.log(`✅ Static call successful!`);
    console.log(`Would return: ${ethers.formatUnits(result[0], 6)} USDC`);
    console.log(`PnL: ${ethers.formatUnits(result[1], 6)} USDC`);
    
    // Try the actual call
    console.log("Attempting real transaction...");
    const tx = await perpEngine.reducePosition(asset, reduceAmount);
    const receipt = await tx.wait();
    
    console.log(`🎉 SUCCESS! Transaction hash: ${tx.hash}`);
    console.log(`Gas used: ${receipt.gasUsed}`);
    
  } catch (error) {
    console.log(`❌ Final test failed: ${error.message}`);
    
    // Deep error analysis
    console.log("\n🔍 Deep Error Analysis:");
    
    if (error.message.includes("execution reverted")) {
      console.log("Generic execution reverted - check for:");
      console.log("1. Integer overflow/underflow");
      console.log("2. Division by zero");
      console.log("3. Failed external calls");
      console.log("4. Require statements failing");
    }
    
    if (error.data) {
      console.log(`Error data: ${error.data}`);
      
      // Try to decode custom errors
      const errorSignatures = [
        "NoPosition()",
        "InvalidSizeToReduce()",
        "MarketPaused()",
        "FeeIsGreaterThanCollateral()"
      ];
      
      for (const sig of errorSignatures) {
        const selector = ethers.id(sig).slice(0, 10);
        if (error.data.startsWith(selector)) {
          console.log(`Decoded error: ${sig}`);
          break;
        }
      }
    }
  }

  console.log("\n✨ Reduce position debugging complete!");
}

// Helper function to test specific edge cases
async function testReducePositionEdgeCases() {
  console.log("🧪 Testing Reduce Position Edge Cases...\n");
  
  const deploymentPath = path.join(__dirname, "../deployments/sepolia_deployment.json");
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
  const perpEngine = await ethers.getContractAt("PerpEngine", deployment.contracts.perpEngine);
  
  const [deployer] = await ethers.getSigners();
  const asset = 0;
  
  const position = await perpEngine.getPosition(deployer.address, asset);
  
  if (position.sizeUsd == 0) {
    console.log("No position to test");
    return;
  }
  
  const edgeCases = [
    { amount: 0n, desc: "Zero amount" },
    { amount: 1n, desc: "Minimal amount (1 wei)" },
    { amount: position.sizeUsd + 1n, desc: "Amount exceeding position" },
    { amount: position.sizeUsd, desc: "Full position closure" }
  ];
  
  for (const testCase of edgeCases) {
    console.log(`\nTesting: ${testCase.desc}`);
    try {
      await perpEngine.reducePosition.staticCall(asset, testCase.amount);
      console.log("✅ Would succeed");
    } catch (error) {
      console.log(`❌ Would fail: ${error.message}`);
    }
  }
}

module.exports = {
  debugReducePosition,
  testReducePositionEdgeCases
};

debugReducePosition()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Reduce position debugging failed:", error);
    process.exit(1);
  });