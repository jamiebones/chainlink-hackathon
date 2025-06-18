const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

// Color codes
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  cyan: "\x1b[36m"
};

async function initializeOracles() {
  console.log(`${colors.cyan}🔮 Initializing Oracle Data...${colors.reset}\n`);

  // Load deployment addresses
  const deploymentPath = path.join(__dirname, `../deployments/${network.name}_deployment.json`);
  
  if (!fs.existsSync(deploymentPath)) {
    throw new Error(`Deployment file not found: ${deploymentPath}`);
  }
  
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
  const deployer = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, ethers.provider);
  
  console.log(`${colors.yellow}📍 Network: ${network.name}${colors.reset}`);
  console.log(`${colors.yellow}📍 Deployer: ${deployer.address}${colors.reset}\n`);
  
  try {
    // Get contract instances
    const tslaOracle = await ethers.getContractAt("TSLAOracleManager", deployment.contracts.tslaOracle);
    const aaplOracle = await ethers.getContractAt("AAPLOracleManager", deployment.contracts.aaplOracle);
    const marketOracle = await ethers.getContractAt("MarketStatusOracle", deployment.contracts.marketStatusOracle);
    
    console.log(`TSLA Oracle: ${deployment.contracts.tslaOracle}`);
    console.log(`AAPL Oracle: ${deployment.contracts.aaplOracle}`);
    console.log(`Market Oracle: ${deployment.contracts.marketStatusOracle}\n`);
    
    // Fund oracles with LINK if needed
    if (process.env.LINK_TOKEN_ADDRESS) {
      console.log(`${colors.bright}💰 Funding oracles with LINK...${colors.reset}`);
      const linkToken = await ethers.getContractAt("IERC20", process.env.LINK_TOKEN_ADDRESS);
      
      // Check current LINK balances
      const tslaBalance = await linkToken.balanceOf(deployment.contracts.tslaOracle);
      const aaplBalance = await linkToken.balanceOf(deployment.contracts.aaplOracle);
      const marketBalance = await linkToken.balanceOf(deployment.contracts.marketStatusOracle);
      
      console.log(`TSLA Oracle LINK balance: ${ethers.formatEther(tslaBalance)}`);
      console.log(`AAPL Oracle LINK balance: ${ethers.formatEther(aaplBalance)}`);
      console.log(`Market Oracle LINK balance: ${ethers.formatEther(marketBalance)}`);
      
      const fundAmount = ethers.parseEther("2"); // 2 LINK each
      
      // Fund if needed
      if (tslaBalance < fundAmount) {
        console.log("Funding TSLA Oracle...");
        await linkToken.transfer(deployment.contracts.tslaOracle, fundAmount);
      }
      if (aaplBalance < fundAmount) {
        console.log("Funding AAPL Oracle...");
        await linkToken.transfer(deployment.contracts.aaplOracle, fundAmount);
      }
      if (marketBalance < fundAmount) {
        console.log("Funding Market Oracle...");
        await linkToken.transfer(deployment.contracts.marketStatusOracle, fundAmount);
      }
      
      console.log(`${colors.green}✅ Oracles funded${colors.reset}\n`);
    }
    
    // Send oracle requests
    console.log(`${colors.bright}📡 Sending oracle requests...${colors.reset}`);
    
    console.log("Requesting TSLA data...");
    const tslaTx = await tslaOracle.sendRequest();
    console.log(`TSLA request sent: ${tslaTx.hash}`);
    
    console.log("Requesting AAPL data...");
    const aaplTx = await aaplOracle.sendRequest();
    console.log(`AAPL request sent: ${aaplTx.hash}`);
    
    console.log("Requesting market status...");
    const marketTx = await marketOracle.sendRequest();
    console.log(`Market status request sent: ${marketTx.hash}`);
    
    // Wait for transactions to be mined
    console.log("\nWaiting for transactions to be mined...");
    await Promise.all([
      tslaTx.wait(),
      aaplTx.wait(),
      marketTx.wait()
    ]);
    
    console.log(`${colors.green}✅ All requests sent successfully!${colors.reset}`);
    console.log(`${colors.yellow}⏳ Waiting 60 seconds for Chainlink responses...${colors.reset}`);
    
    // Wait for Chainlink to fulfill
    await new Promise(resolve => setTimeout(resolve, 60000));
    
    // Check responses
    console.log(`\n${colors.bright}🔍 Checking oracle responses...${colors.reset}`);
    
    try {
      // Check TSLA
      const tslaPrice = await tslaOracle.getLatestPrice();
      if (tslaPrice > 0) {
        console.log(`${colors.green}✅ TSLA: $${ethers.formatUnits(tslaPrice, 18)}${colors.reset}`);
      } else {
        console.log(`${colors.yellow}⚠️  TSLA: No price data yet${colors.reset}`);
      }
      
      // Check AAPL
      const aaplPrice = await aaplOracle.getLatestPrice();
      if (aaplPrice > 0) {
        console.log(`${colors.green}✅ AAPL: $${ethers.formatUnits(aaplPrice, 18)}${colors.reset}`);
      } else {
        console.log(`${colors.yellow}⚠️  AAPL: No price data yet${colors.reset}`);
      }
      
      // Check market status
      const isOpen = await marketOracle.isMarketOpen();
      console.log(`${colors.green}✅ Market: ${isOpen ? 'OPEN' : 'CLOSED'}${colors.reset}`);
      
    } catch (error) {
      console.log(`${colors.yellow}⚠️  Some oracle data not available yet - this is normal${colors.reset}`);
      console.log(`${colors.yellow}    Chainlink responses can take 1-5 minutes${colors.reset}`);
    }
    
    console.log(`\n${colors.cyan}🎉 Oracle initialization complete!${colors.reset}`);
    console.log(`${colors.cyan}📋 You can run this script again later to check updated prices${colors.reset}`);
    
  } catch (error) {
    console.error(`${colors.red}❌ Oracle initialization failed:${colors.reset}`, error);
    throw error;
  }
}

// Run the initialization
initializeOracles()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });