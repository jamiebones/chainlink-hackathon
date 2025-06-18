const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function enhancedDebugScript() {
  console.log("🔍 Enhanced Debug Script with Detailed Error Analysis...\n");

  // Load deployment
  const deploymentPath = path.join(__dirname, "../deployments/fuji_deployment.json");
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
  const contracts = deployment.contracts;
  const [deployer] = await ethers.getSigners();

  // Get contract instances
  const perpEngine = await ethers.getContractAt("PerpEngine", contracts.perpEngine);
  const usdc = await ethers.getContractAt("MockERC20", contracts.usdc);
  const liquidityPool = await ethers.getContractAt("LiquidityPool", contracts.liquidityPool);
  const chainlinkManager = await ethers.getContractAt("ChainlinkManager", contracts.chainlinkManager);

  console.log(`Debugger: ${deployer.address}\n`);

  // ============================================================================
  // DIAGNOSTIC PHASE 1: Check Current Position State
  // ============================================================================
  
  console.log("🔍 === DIAGNOSTIC PHASE 1: POSITION STATE ===");
  
  const asset = 0; // TSLA
  
  try {
    const position = await perpEngine.getPosition(deployer.address, asset);
    console.log(`Current position size: ${ethers.formatUnits(position.sizeUsd, 6)} USD`);
    console.log(`Current collateral: ${ethers.formatUnits(position.collateral, 6)} USDC`);
    console.log(`Entry price: ${ethers.formatUnits(position.entryPrice, 18)}`);
    console.log(`Is long: ${position.isLong}`);
    console.log(`Entry funding rate: ${ethers.formatUnits(position.entryFundingRate, 18)}`);
    
    if (position.sizeUsd > 0) {
      console.log("✅ Position exists - testing modifications\n");
    } else {
      console.log("❌ No position found - need to open one first\n");
      return;
    }
  } catch (error) {
    console.log(`❌ Failed to get position: ${error.message}\n`);
    return;
  }

  // ============================================================================
  // DIAGNOSTIC PHASE 2: Oracle and Market Status
  // ============================================================================
  
  console.log("🔮 === DIAGNOSTIC PHASE 2: ORACLE & MARKET STATUS ===");
  
  try {
    const isPaused = await chainlinkManager.checkIfAssetIsPaused(asset);
    const marketPaused = await perpEngine.isPaused();
    const currentPrice = await chainlinkManager.getPrice(asset);
    const dexPrice = await chainlinkManager.getDexPrice(asset);
    
    console.log(`Oracle paused: ${isPaused}`);
    console.log(`Market paused: ${marketPaused}`);
    console.log(`Current price: ${ethers.formatUnits(currentPrice, 18)}`);
    console.log(`DEX price: ${ethers.formatUnits(dexPrice, 18)}`);
    
    if (isPaused || marketPaused) {
      console.log("❌ Market or oracle is paused - this would cause failures\n");
      return;
    }
    
    if (currentPrice == 0 || dexPrice == 0) {
      console.log("❌ Invalid prices - this would cause failures\n");
      return;
    }
    
    console.log("✅ Oracle and market status OK\n");
    
  } catch (error) {
    console.log(`❌ Oracle check failed: ${error.message}\n`);
    return;
  }

  // ============================================================================
  // DIAGNOSTIC PHASE 3: Funding Rate Impact
  // ============================================================================
  
  console.log("💰 === DIAGNOSTIC PHASE 3: FUNDING RATE ANALYSIS ===");
  
  try {
    const currentFundingRate = await perpEngine.getFundingRate(asset);
    const position = await perpEngine.getPosition(deployer.address, asset);
    
    console.log(`Current cumulative funding rate: ${ethers.formatUnits(currentFundingRate, 18)}`);
    console.log(`Position entry funding rate: ${ethers.formatUnits(position.entryFundingRate, 18)}`);
    
    const fundingDelta = currentFundingRate - position.entryFundingRate;
    console.log(`Funding delta: ${ethers.formatUnits(fundingDelta, 18)}`);
    
    // Calculate potential funding impact
    const fundingImpact = (position.sizeUsd * fundingDelta) / ethers.parseUnits("1", 18);
    console.log(`Potential funding impact: ${ethers.formatUnits(fundingImpact, 6)} USDC`);
    
    if (position.isLong && fundingDelta > 0) {
      console.log("⚠️  Long position with positive funding - will pay fees");
      if (fundingImpact >= position.collateral) {
        console.log("❌ CRITICAL: Funding fee would exceed collateral!");
        return;
      }
    } else if (!position.isLong && fundingDelta < 0) {
      console.log("⚠️  Short position with negative funding - will pay fees");
      const absFundingImpact = fundingImpact < 0 ? -fundingImpact : fundingImpact;
      if (absFundingImpact >= position.collateral) {
        console.log("❌ CRITICAL: Funding fee would exceed collateral!");
        return;
      }
    }
    
    console.log("✅ Funding impact acceptable\n");
    
  } catch (error) {
    console.log(`❌ Funding analysis failed: ${error.message}\n`);
  }

  // ============================================================================
  // DIAGNOSTIC PHASE 4: Borrowing Fee Impact
  // ============================================================================
  
  console.log("🏦 === DIAGNOSTIC PHASE 4: BORROWING FEE ANALYSIS ===");
  
  try {
    const position = await perpEngine.getPosition(deployer.address, asset);
    const borrowingRateAnnual = await perpEngine.borrowingRateAnnualBps();
    
    // Calculate time elapsed since last update
    const currentTime = Math.floor(Date.now() / 1000);
    const lastUpdate = Number(position.lastBorrowingUpdate || 0);
    const timeElapsed = currentTime - lastUpdate;
    
    console.log(`Borrowing rate annual: ${borrowingRateAnnual} bps`);
    console.log(`Time since last update: ${timeElapsed} seconds (${(timeElapsed / 3600).toFixed(2)} hours)`);
    
    // Calculate potential borrowing fee
    const borrowingFee = (position.sizeUsd * borrowingRateAnnual * BigInt(timeElapsed)) / 
                        (365n * 24n * 3600n) / 10000n;
    
    console.log(`Potential borrowing fee: ${ethers.formatUnits(borrowingFee, 6)} USDC`);
    
    if (borrowingFee >= position.collateral) {
      console.log("❌ CRITICAL: Borrowing fee would exceed collateral!");
      return;
    }
    
    console.log("✅ Borrowing fee acceptable\n");
    
  } catch (error) {
    console.log(`❌ Borrowing fee analysis failed: ${error.message}\n`);
  }

  // ============================================================================
  // DIAGNOSTIC PHASE 5: Test Individual Functions with Static Calls
  // ============================================================================
  
  console.log("🧪 === DIAGNOSTIC PHASE 5: STATIC CALL TESTS ===");
  
//   const testAmount = ethers.parseUnits("50", 6); // Small test amount
  
//   // Test addCollateral
//   console.log("Testing addCollateral...");
//   try {
//     await perpEngine.addCollateral.staticCall(asset, testAmount);
//     console.log("✅ addCollateral static call successful");
//   } catch (error) {
//     console.log(`❌ addCollateral would fail: ${error.message}`);
//     await analyzeRevertReason(error, perpEngine);
//   }
  
  // Test increasePosition  
  console.log("Testing increasePosition...");
  try {
    await perpEngine.increasePosition.staticCall(asset, testAmount);
    console.log("✅ increasePosition static call successful");
  } catch (error) {
    console.log(`❌ increasePosition would fail: ${error.message}`);
    await analyzeRevertReason(error, perpEngine);
  }
  
  // Test withdrawCollateral
  console.log("Testing withdrawCollateral...");
  try {
    await perpEngine.withdrawCollateral.staticCall(asset, testAmount);
    console.log("✅ withdrawCollateral static call successful");
  } catch (error) {
    console.log(`❌ withdrawCollateral would fail: ${error.message}`);
    await analyzeRevertReason(error, perpEngine);
  }
  
  // Test reducePosition
  console.log("Testing reducePosition...");
  try {
    const position = await perpEngine.getPosition(deployer.address, asset);
    const reduceAmount = position.sizeUsd / 4n; // Reduce by 25%
    await perpEngine.reducePosition.staticCall(asset, reduceAmount);
    console.log("✅ reducePosition static call successful");
  } catch (error) {
    console.log(`❌ reducePosition would fail: ${error.message}`);
    await analyzeRevertReason(error, perpEngine);
  }
  
  // Test closePosition
  console.log("Testing closePosition...");
  try {
    await perpEngine.closePosition.staticCall(asset);
    console.log("✅ closePosition static call successful");
  } catch (error) {
    console.log(`❌ closePosition would fail: ${error.message}`);
    await analyzeRevertReason(error, perpEngine);
  }

  // ============================================================================
  // DIAGNOSTIC PHASE 6: Fix BigInt Issues in View Functions
  // ============================================================================
  
  console.log("\n🔢 === DIAGNOSTIC PHASE 6: VIEW FUNCTION FIXES ===");
  
  try {
    const position = await perpEngine.getPosition(deployer.address, asset);
    const collateralRatio = await perpEngine.getCollateralRatio(deployer.address, asset);
    const leverage = await perpEngine.getLeverage(deployer.address, asset);
    
    // Fix BigInt issues by converting properly
    console.log(`Collateral Ratio: ${Number(collateralRatio) / 100}%`);
    console.log(`Leverage: ${Number(leverage) / 1e6}x`);
    
    const poolUtilization = await perpEngine.getPoolUtilization();
    console.log(`Pool Utilization: ${Number(poolUtilization) / 100}%`);
    
    console.log("✅ View functions working with proper BigInt handling");
    
  } catch (error) {
    console.log(`❌ View functions failed: ${error.message}`);
  }

  console.log("\n✨ Enhanced debugging complete!");
}

// Helper function to analyze revert reasons
async function analyzeRevertReason(error, perpEngine) {
  if (error.data) {
    try {
      const iface = perpEngine.interface;
      const decodedError = iface.parseError(error.data);
      console.log(`   🔍 Decoded error: ${decodedError.name}`);
      if (decodedError.args && decodedError.args.length > 0) {
        console.log(`   📋 Error args:`, decodedError.args.map(arg => arg.toString()));
      }
    } catch (decodeError) {
      console.log(`   ⚠️  Could not decode error data: ${error.data}`);
    }
  }
  
  // Provide specific guidance based on common errors
  const errorMessage = error.message.toLowerCase();
  
  if (errorMessage.includes('positionundercollateralized')) {
    console.log("   💡 Position became under-collateralized due to funding/borrowing fees");
    console.log("   💡 Try adding more collateral first, or close the position");
  } else if (errorMessage.includes('feisgreaterthandcollateral')) {
    console.log("   💡 Fee exceeds available collateral");
    console.log("   💡 Position needs more collateral or should be closed");
  } else if (errorMessage.includes('oracle')) {
    console.log("   💡 Oracle-related issue - check price feeds");
  } else if (errorMessage.includes('paused')) {
    console.log("   💡 Market is paused");
  }
}

enhancedDebugScript()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Enhanced debug failed:", error);
    process.exit(1);
  });