const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function addLiquidityToPool() {
  console.log("💰 Adding Liquidity to Pool...\n");

  // Load deployment
  const deploymentPath = path.join(__dirname, "../deployments/fuji_deployment.json");
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
  const contracts = deployment.contracts;
  const [deployer] = await ethers.getSigners();

  // Get contract instances
  const liquidityPool = await ethers.getContractAt("LiquidityPool", contracts.liquidityPool);
  const usdc = await ethers.getContractAt("MockERC20", contracts.usdc);

  console.log(`Adding liquidity from: ${deployer.address}\n`);

  // Check current pool state
  console.log("📊 Current Pool State:");
  const totalLiquidity = await liquidityPool.totalLiquidity();
  const availableLiquidity = await liquidityPool.availableLiquidity();
  const reservedLiquidity = await liquidityPool.reservedLiquidity();
  
  console.log(`Total liquidity: ${ethers.formatUnits(totalLiquidity, 6)} USDC`);
  console.log(`Available liquidity: ${ethers.formatUnits(availableLiquidity, 6)} USDC`);
  console.log(`Reserved liquidity: ${ethers.formatUnits(reservedLiquidity, 6)} USDC\n`);

  // Check user USDC balance
  console.log("💳 Checking USDC Balance:");
  let userBalance = await usdc.balanceOf(deployer.address);
  console.log(`Current balance: ${ethers.formatUnits(userBalance, 6)} USDC`);

  // Mint more USDC if needed
  const depositAmount = ethers.parseUnits("10000", 6); // 10,000 USDC
  if (userBalance < depositAmount) {
    console.log("Minting more test USDC...");
    const mintTx = await usdc.mint(deployer.address, depositAmount);
    await mintTx.wait();
    userBalance = await usdc.balanceOf(deployer.address);
    console.log(`✅ New balance: ${ethers.formatUnits(userBalance, 6)} USDC`);
  }

  // Set approval for liquidity pool
  console.log("\n🔐 Setting Approval:");
  const currentAllowance = await usdc.allowance(deployer.address, contracts.liquidityPool);
  if (currentAllowance < depositAmount) {
    const approveTx = await usdc.approve(contracts.liquidityPool, ethers.MaxUint256);
    await approveTx.wait();
    console.log("✅ Unlimited approval set for LiquidityPool");
  }

  // Deposit liquidity
  console.log("\n💰 Depositing Liquidity:");
  console.log(`Depositing ${ethers.formatUnits(depositAmount, 6)} USDC...`);
  
  try {
    const depositTx = await liquidityPool.deposit(depositAmount);
    const receipt = await depositTx.wait();
    
    // Get LP tokens received
    const events = receipt.logs.map(log => {
      try {
        return liquidityPool.interface.parseLog(log);
      } catch {
        return null;
      }
    }).filter(Boolean);
    
    const depositEvent = events.find(e => e.name === "Deposited");
    if (depositEvent) {
      console.log(`✅ Liquidity added successfully!`);
      console.log(`USDC deposited: ${ethers.formatUnits(depositEvent.args.usdcAmount, 6)}`);
      console.log(`LP tokens received: ${ethers.formatUnits(depositEvent.args.lpTokens, 6)}`);
    }
    
  } catch (error) {
    console.log(`❌ Deposit failed: ${error.message}`);
    return;
  }

  // Check new pool state
  console.log("\n📊 New Pool State:");
  const newTotalLiquidity = await liquidityPool.totalLiquidity();
  const newAvailableLiquidity = await liquidityPool.availableLiquidity();
  
  console.log(`Total liquidity: ${ethers.formatUnits(newTotalLiquidity, 6)} USDC`);
  console.log(`Available liquidity: ${ethers.formatUnits(newAvailableLiquidity, 6)} USDC`);

  // Check LP token balance
  const lpBalance = await liquidityPool.balanceOf(deployer.address);
  console.log(`Your LP tokens: ${ethers.formatUnits(lpBalance, 6)}`);

  console.log("\n✅ Liquidity addition complete! You can now run larger position tests.");
}

addLiquidityToPool()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Failed to add liquidity:", error);
    process.exit(1);
  });