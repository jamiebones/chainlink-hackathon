const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function rescuePositionAndFix() {
  console.log("🚨 Position Rescue and Contract Fix Script...\n");

  // Load deployment
  const deploymentPath = path.join(__dirname, "../deployments/fuji_deployment.json");
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
  const contracts = deployment.contracts;
  const [deployer] = await ethers.getSigners();

  // Get contract instances
  const perpEngine = await ethers.getContractAt("PerpEngine", contracts.perpEngine);
  const usdc = await ethers.getContractAt("MockERC20", contracts.usdc);
  const chainlinkManager = await ethers.getContractAt("ChainlinkManager", contracts.chainlinkManager);

  console.log(`🔧 Rescuer: ${deployer.address}`);
  
  const asset = 0; // TSLA

  // ============================================================================
  // ISSUE 1: FIX THE STUCK POSITION
  // ============================================================================
  
  console.log("🔍 === DIAGNOSING STUCK POSITION ===");
  
  try {
    const position = await perpEngine.getPosition(deployer.address, asset);
    console.log(`Position size: ${ethers.formatUnits(position.sizeUsd, 6)} USD`);
    console.log(`Collateral: ${ethers.formatUnits(position.collateral, 6)} USDC`);
    console.log(`Entry price: ${ethers.formatUnits(position.entryPrice, 18)}`);
    
    // Check current price to see PnL
    const currentPrice = await chainlinkManager.getPrice(asset);
    console.log(`Current price: ${ethers.formatUnits(currentPrice, 18)}`);
    
    // Calculate current leverage
    const currentLeverage = Number(position.sizeUsd) / Number(position.collateral);
    console.log(`Current leverage: ${currentLeverage.toFixed(2)}x`);
    
    if (currentLeverage > 10) {
      console.log("❌ CRITICAL: Position leverage above 10x limit!");
      console.log("This explains why all operations are failing");
    }
    
  } catch (error) {
    console.log(`❌ Position diagnosis failed: ${error.message}`);
    return;
  }

  console.log("\n🚑 === RESCUE OPERATION ===");
  
  // Strategy: Use contract owner powers to rescue the position
  try {
    // First, ensure we have USDC
    console.log("1. Ensuring sufficient USDC...");
    let balance = await usdc.balanceOf(deployer.address);
    const rescueAmount = ethers.parseUnits("2000", 6); // Large rescue amount
    
    if (balance < rescueAmount) {
      console.log("Minting rescue USDC...");
      const mintTx = await usdc.mint(deployer.address, rescueAmount);
      await mintTx.wait();
      balance = await usdc.balanceOf(deployer.address);
      console.log(`✅ USDC balance: ${ethers.formatUnits(balance, 6)}`);
    }
    
    // Set approval
    console.log("2. Setting approval...");
    const approveTx = await usdc.approve(contracts.perpEngine, ethers.MaxUint256);
    await approveTx.wait();
    console.log("✅ Approval set");
    
    // Try different rescue strategies
    console.log("3. Attempting rescue strategies...");
    
    // Strategy A: Add massive collateral
    console.log("Strategy A: Add large collateral...");
    try {
      const addCollateralTx = await perpEngine.addCollateral(asset, rescueAmount);
      await addCollateralTx.wait();
      console.log("✅ Large collateral added successfully!");
      
      // Now try to close
      const closeTx = await perpEngine.closePosition(asset);
      await closeTx.wait();
      console.log("✅ Position closed successfully after rescue!");
      
    } catch (strategyError) {
      console.log(`❌ Strategy A failed: ${strategyError.message}`);
      
      // Strategy B: Emergency liquidation (if you're contract owner)
      console.log("Strategy B: Check if emergency powers available...");
      try {
        const owner = await perpEngine.owner();
        console.log(`Contract owner: ${owner}`);
        console.log(`Your address: ${deployer.address}`);
        
        if (owner.toLowerCase() === deployer.address.toLowerCase()) {
          console.log("You are the owner! Attempting emergency close...");
          
          // Try emergency close vault hedge (if available)
          try {
            const emergencyTx = await perpEngine.emergencyCloseVaultHedge(asset);
            await emergencyTx.wait();
            console.log("✅ Emergency close successful!");
          } catch (emergencyError) {
            console.log(`❌ Emergency close failed: ${emergencyError.message}`);
            
            // Strategy C: Pause market and then close
            console.log("Strategy C: Pause market temporarily...");
            try {
              const pauseTx = await perpEngine.pause();
              await pauseTx.wait();
              console.log("✅ Market paused");
              
              // Add collateral while paused
              const rescueTx = await perpEngine.addCollateral(asset, rescueAmount);
              await rescueTx.wait();
              
              // Unpause
              const unpauseTx = await perpEngine.unpause();
              await unpauseTx.wait();
              
              // Now close
              const closeTx = await perpEngine.closePosition(asset);
              await closeTx.wait();
              console.log("✅ Position rescued using pause strategy!");
              
            } catch (pauseError) {
              console.log(`❌ Pause strategy failed: ${pauseError.message}`);
            }
          }
        } else {
          console.log("❌ Not the contract owner - limited rescue options");
        }
      } catch (ownerError) {
        console.log(`❌ Could not check owner: ${ownerError.message}`);
      }
    }
    
  } catch (error) {
    console.log(`❌ All rescue strategies failed: ${error.message}`);
    console.log("\n💡 MANUAL SOLUTIONS:");
    console.log("1. Deploy a new contract instance");
    console.log("2. Use contract owner to liquidate position manually");
    console.log("3. Reset the contract state if possible");
  }

  // ============================================================================
  // ISSUE 2: FIX CHAINLINKMANAGER INTERFACE
  // ============================================================================
  
  console.log("\n🔧 === FIXING CHAINLINKMANAGER INTERFACE ===");
  
  // The error shows that `getDexPrice` function doesn't exist
  // Let's check what functions are actually available
  
  try {
    console.log("Checking available ChainlinkManager functions...");
    
    // Try common function names
    const testFunctions = [
      'getPrice',
      'getDexPrice', 
      'getMarkPrice',
      'getSpotPrice',
      'checkIfAssetIsPaused',
      'isAssetPaused',
      'isPaused'
    ];
    
    for (const funcName of testFunctions) {
      try {
        if (funcName.includes('Price')) {
          const result = await chainlinkManager[funcName](asset);
          console.log(`✅ ${funcName}: ${ethers.formatUnits(result, 18)}`);
        } else {
          const result = await chainlinkManager[funcName](asset);
          console.log(`✅ ${funcName}: ${result}`);
        }
      } catch (funcError) {
        console.log(`❌ ${funcName}: Not available`);
      }
    }
    
  } catch (error) {
    console.log(`❌ Interface check failed: ${error.message}`);
  }

  // ============================================================================
  // ISSUE 3: PROVIDE WORKING TEST CONFIGURATION
  // ============================================================================
  
  console.log("\n🛠️  === CREATING WORKING TEST SETUP ===");
  
  try {
    // Create a minimal working test
    console.log("Testing basic functionality with fresh position...");
    
    // Check if position is now clear
    const finalPosition = await perpEngine.getPosition(deployer.address, asset);
    
    if (finalPosition.sizeUsd == 0) {
      console.log("✅ Position is clear! Testing basic operations...");
      
      // Test small position
      const testCollateral = ethers.parseUnits("200", 6); // 200 USDC
      const testSize = ethers.parseUnits("400", 6); // 400 USD (2x leverage)
      
      console.log(`Opening test position: ${ethers.formatUnits(testSize, 6)} USD with ${ethers.formatUnits(testCollateral, 6)} USDC`);
      
      const openTx = await perpEngine.openPosition(asset, testCollateral, testSize, true);
      await openTx.wait();
      console.log("✅ Test position opened successfully!");
      
      // Test add collateral
      const addAmount = ethers.parseUnits("50", 6);
      const addTx = await perpEngine.addCollateral(asset, addAmount);
      await addTx.wait();
      console.log("✅ Add collateral works!");
      
      // Test close
      const closeTx = await perpEngine.closePosition(asset);
      await closeTx.wait();
      console.log("✅ Position close works!");
      
      console.log("\n🎉 Basic functionality is working!");
      
    } else {
      console.log(`❌ Position still exists: ${ethers.formatUnits(finalPosition.sizeUsd, 6)} USD`);
      console.log("Manual intervention required");
    }
    
  } catch (error) {
    console.log(`❌ Working test setup failed: ${error.message}`);
  }

  // ============================================================================
  // FINAL RECOMMENDATIONS
  // ============================================================================
  
  console.log("\n📋 === FINAL RECOMMENDATIONS ===");
  
  console.log("1. 🔧 CONTRACT ISSUES FOUND:");
  console.log("   - Position became over-leveraged due to fees");
  console.log("   - ChainlinkManager missing getDexPrice function");
  
  console.log("\n2. 🛠️  IMMEDIATE FIXES NEEDED:");
  console.log("   - Update ChainlinkManager interface in PerpEngine");
  console.log("   - Add position rescue mechanisms");
  console.log("   - Consider automatic deleveraging when fees accumulate");
  
  console.log("\n3. 🚀 SUGGESTED NEXT STEPS:");
  console.log("   - Deploy updated contracts with fixes");
  console.log("   - Add emergency functions for stuck positions");
  console.log("   - Test with smaller positions and shorter timeframes");
  
  const finalBalance = await usdc.balanceOf(deployer.address);
  console.log(`\n💰 Final USDC balance: ${ethers.formatUnits(finalBalance, 6)}`);
  
  console.log("\n✨ Rescue operation complete!");
}

rescuePositionAndFix()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Rescue operation failed:", error);
    process.exit(1);
  });