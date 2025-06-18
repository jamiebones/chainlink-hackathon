const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function debugPerpEngineOpenPosition() {
  console.log("🔍 Debugging PerpEngine.openPosition on Sepolia...\n");

  // Load deployment
  const deploymentPath = path.join(__dirname, "../deployments/fuji_deployment.json");
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
  const contracts = deployment.contracts;

  const [deployer] = await ethers.getSigners();
  console.log(`Debugger: ${deployer.address}\n`);

  // Get contract instances
  const perpEngine = await ethers.getContractAt("PerpEngine", contracts.perpEngine);
  const usdc = await ethers.getContractAt("MockERC20", contracts.usdc);
  const chainlinkManager = await ethers.getContractAt("ChainlinkManager", contracts.chainlinkManager);
  const liquidityPool = await ethers.getContractAt("LiquidityPool", contracts.liquidityPool);

  // Test parameters - adjust these based on your call
  const asset = 0; // TSLA
  const collateralAmount = ethers.parseUnits("100", 6); // 100 USDC
  const sizeUsd = ethers.parseUnits("500", 6); // 500 USD position (5x leverage)
  const isLong = true;

  console.log("📋 Test Parameters:");
  console.log(`Asset: ${asset === 0 ? 'TSLA' : 'AAPL'}`);
  console.log(`Collateral: ${ethers.formatUnits(collateralAmount, 6)} USDC`);
  console.log(`Size: ${ethers.formatUnits(sizeUsd, 6)} USD`);
  console.log(`Is Long: ${isLong}`);
  console.log(`Calculated Leverage: ${Number(sizeUsd) / Number(collateralAmount)}x\n`);

  // Step 1: Check basic requirements
  console.log("1. 🔍 Checking Basic Requirements:");
  
  try {
    // Check if oracle is paused
    const isPaused = await chainlinkManager.checkIfAssetIsPaused(asset);
    console.log(`✅ Oracle paused: ${isPaused}`);
    if (isPaused) {
      console.log("❌ ISSUE: Oracle is paused!");
    }

    // Check if market is paused
    const isMarketPaused = await perpEngine.isPaused();
    console.log(`✅ Market paused: ${isMarketPaused}`);
    if (isMarketPaused) {
      console.log("❌ ISSUE: Market is paused!");
    }

    // Check if user already has position
    const existingPosition = await perpEngine.positions(deployer.address, asset);
    console.log(`✅ Existing position size: ${ethers.formatUnits(existingPosition.sizeUsd, 6)} USD`);
    if (existingPosition.sizeUsd > 0) {
      console.log("❌ ISSUE: User already has a position!");
    }

    // Check leverage calculation
    const leverage = (sizeUsd * ethers.parseUnits("1", 6)) / collateralAmount;
    console.log(`✅ Leverage: ${ethers.formatUnits(leverage, 6)}x`);
    if (leverage < ethers.parseUnits("1", 6) || leverage > ethers.parseUnits("10", 6)) {
      console.log("❌ ISSUE: Leverage outside 1x-10x range!");
    }

  } catch (error) {
    console.log(`❌ Basic requirements check failed: ${error.message}`);
  }

  // Step 2: Check fee calculation and balances
  console.log("\n2. 💰 Checking Fees and Balances:");
  
  try {
    // Get open fee
    const openFeeBps = await perpEngine.openFeeBps();
    const openFee = (sizeUsd * openFeeBps) / 10000n;
    const netCollateral = collateralAmount - openFee;
    
    console.log(`✅ Open fee BPS: ${openFeeBps}`);
    console.log(`✅ Open fee: ${ethers.formatUnits(openFee, 6)} USDC`);
    console.log(`✅ Net collateral: ${ethers.formatUnits(netCollateral, 6)} USDC`);

    if (collateralAmount < openFee) {
      console.log("❌ ISSUE: Collateral less than fee!");
    }

    // Check user balance
    const userBalance = await usdc.balanceOf(deployer.address);
    console.log(`✅ User USDC balance: ${ethers.formatUnits(userBalance, 6)}`);
    if (userBalance < collateralAmount) {
      console.log("❌ ISSUE: Insufficient user balance!");
    }

    // Check fee receiver
    const feeReceiver = await perpEngine.feeReceiver();
    console.log(`✅ Fee receiver: ${feeReceiver}`);
    if (feeReceiver === ethers.ZeroAddress) {
      console.log("❌ ISSUE: Fee receiver not set!");
    }

  } catch (error) {
    console.log(`❌ Fee/balance check failed: ${error.message}`);
  }

  // Step 3: Check allowances
  console.log("\n3. 🔐 Checking Allowances:");
  
  try {
    const userToPerpAllowance = await usdc.allowance(deployer.address, contracts.perpEngine);
    console.log(`✅ User->PerpEngine allowance: ${ethers.formatUnits(userToPerpAllowance, 6)} USDC`);
    
    if (userToPerpAllowance < collateralAmount) {
      console.log("Setting approval...");
      const approveTx = await usdc.approve(contracts.perpEngine, ethers.MaxUint256);
      await approveTx.wait();
      console.log("✅ Approval set");
    }

  } catch (error) {
    console.log(`❌ Allowance check failed: ${error.message}`);
    return;
  }

  // Step 4: Check liquidity pool
  console.log("\n4. 🏊 Checking Liquidity Pool:");
  
  try {
    const totalLiquidity = await liquidityPool.totalLiquidity();
    const availableLiquidity = await liquidityPool.availableLiquidity();
    
    console.log(`✅ Total liquidity: ${ethers.formatUnits(totalLiquidity, 6)} USDC`);
    console.log(`✅ Available liquidity: ${ethers.formatUnits(availableLiquidity, 6)} USDC`);
    
    if (availableLiquidity < sizeUsd) {
      console.log("❌ ISSUE: Insufficient liquidity for position size!");
      return;
    }

  } catch (error) {
    console.log(`❌ Liquidity check failed: ${error.message}`);
    return;
  }

  // Step 5: Check oracle price
  console.log("\n5. 🔮 Checking Oracle Price:");
  
  try {
    const price = await chainlinkManager.getPrice(asset);
    console.log(`✅ Current price: ${ethers.formatUnits(price, 18)}`);
    
    if (price == 0) {
      console.log("❌ ISSUE: Price is zero!");
      return;
    }

  } catch (error) {
    console.log(`❌ Price check failed: ${error.message}`);
    console.log("This is likely the main issue - oracle problems on Sepolia");
    return;
  }

  // Step 6: Check utilization limits
  console.log("\n6. 📊 Checking Utilization:");
  
  try {
    // Try to call the internal _validateUtilization by checking open interest
    const longOpenInterest = await perpEngine.longOpenInterestUsd(asset);
    const shortOpenInterest = await perpEngine.shortOpenInterestUsd(asset);
    
    console.log(`✅ Long open interest: ${ethers.formatUnits(longOpenInterest, 6)} USD`);
    console.log(`✅ Short open interest: ${ethers.formatUnits(shortOpenInterest, 6)} USD`);
    
    // Check if adding this position would exceed limits
    const newOpenInterest = isLong ? longOpenInterest + sizeUsd : shortOpenInterest + sizeUsd;
    const maxUtilization = (totalLiquidity * 80n) / 100n; // Assuming 80% max utilization
    
    console.log(`✅ New open interest would be: ${ethers.formatUnits(newOpenInterest, 6)} USD`);
    console.log(`✅ Max utilization (80%): ${ethers.formatUnits(maxUtilization, 6)} USD`);
    
    if (newOpenInterest > maxUtilization) {
      console.log("❌ ISSUE: Position would exceed utilization limits!");
      return;
    }

  } catch (error) {
    console.log(`❌ Utilization check failed: ${error.message}`);
  }

  // Step 7: Static call test
  console.log("\n7. 🧪 Testing with Static Call:");
  
  try {
    console.log(asset, collateralAmount, sizeUsd, isLong);
    await perpEngine.openPosition.staticCall(asset, collateralAmount, sizeUsd, isLong);
    console.log("✅ Static call successful - transaction should work");
  } catch (error) {
    console.log(`❌ Static call failed: ${error.message}`);
    
    // Detailed error analysis
    if (error.data) {
      console.log(`Error data: ${error.data}`);
      
      // Try to decode common errors
      try {
        const iface = perpEngine.interface;
        const decodedError = iface.parseError(error.data);
        console.log(`Decoded error: ${decodedError.name}`);
        console.log(`Error args:`, decodedError.args);
      } catch (decodeError) {
        console.log("Could not decode error data");
      }
    }
    
    // Common error patterns
    if (error.message.includes("Oracle paused")) {
      console.log("🔍 Oracle is paused - check Chainlink setup");
    } else if (error.message.includes("InvalidPosition")) {
      console.log("🔍 Invalid position parameters");
    } else if (error.message.includes("MarketPaused")) {
      console.log("🔍 Market is paused");
    } else if (error.message.includes("AlreadyOpen")) {
      console.log("🔍 Position already exists");
    } else if (error.message.includes("Leverage")) {
      console.log("🔍 Leverage outside allowed range");
    } else if (error.message.includes("Fee receiver")) {
      console.log("🔍 Fee receiver not set");
    } else if (error.message.includes("invalidPrice")) {
      console.log("🔍 Price is zero - oracle issue");
    }
    
    return;
  }

  // Step 8: Actual transaction
  console.log("\n8. 🚀 Attempting Real Transaction:");
  
  try {
    const tx = await perpEngine.openPosition(asset, collateralAmount, sizeUsd, isLong, {
      gasLimit: 400000, // Higher gas limit
      gasPrice: ethers.parseUnits("2", "gwei")
    });
    
    console.log(`Transaction sent: ${tx.hash}`);
    const receipt = await tx.wait();
    console.log(`✅ Transaction successful! Block: ${receipt.blockNumber}`);
    
  } catch (error) {
    console.log(`❌ Transaction failed: ${error.message}`);
    
    if (error.receipt) {
      console.log(`Gas used: ${error.receipt.gasUsed}`);
      console.log(`Status: ${error.receipt.status}`);
    }
  }

  console.log("\n✨ Debug complete!");
}

debugPerpEngineOpenPosition()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Debug failed:", error);
    process.exit(1);
  });