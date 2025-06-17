const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");
require("dotenv").config();


// Color codes for console output
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  cyan: "\x1b[36m"
};

const { router, donId, gasLimit } = network.config;

// Deployment configuration
const CONFIG = {
  // Chainlink subscription IDs (update for your network)
  chainlinkSubscriptionId: 15598, // Update with your subscription ID
  
  // Initial liquidity amounts
  initialLiquidityUSDC: ethers.parseUnits("1000", 6), // 1000 USDC
  
  // Team addresses
  treasury: null, // Will use deployer if not set
  teamMultisig: null, // Will use deployer if not set
  
  // Oracle configuration
  oracleWindowSize: 10, // 60 data points for TWAP
  
  // Fee configuration
  lpShare: 7000, // 70%
  protocolShare: 3000, // 30%
};

async function main() {
  console.log(`${colors.cyan}🚀 Starting Synthetic Equity Protocol Deployment${colors.reset}\n`);

  if (!process.env.LP_PROVIDER_PRIVATE_KEY || !process.env.FEE_RECEIVER_PRIVATE_KEY) {
    console.warn(`${colors.red}⚠️  One or more private keys are missing in .env — falling back to DEPLOYER key${colors.reset}`);
  }

  const deployer = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, ethers.provider);
  const lpProvider = new ethers.Wallet(process.env.LP_PROVIDER_PRIVATE_KEY || process.env.DEPLOYER_PRIVATE_KEY, ethers.provider);
  const feeReceiver = new ethers.Wallet(process.env.FEE_RECEIVER_PRIVATE_KEY || process.env.DEPLOYER_PRIVATE_KEY, ethers.provider);

  console.log(`${colors.yellow}📍 Network: ${network.name}${colors.reset}`);

  console.log(`${colors.yellow}📍 Deployer address: ${deployer.address}${colors.reset}`);
  console.log(`${colors.yellow}📍 LP Provider address: ${lpProvider.address}${colors.reset}`);
  console.log(`${colors.yellow}📍 Fee Receiver address: ${feeReceiver.address}${colors.reset}\n`);

  // Check deployer balance
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`${colors.yellow}💰 Deployer balance: ${ethers.formatEther(balance)} ETH${colors.reset}\n`);

  // Object to store all deployed addresses
  const deployments = {};

  try {
    // ========================================
    // 1. Deploy Mock USDC (for testnet)
    // ========================================
    console.log(`${colors.bright}1. Deploying USDC...${colors.reset}`);
    const MockUSDC = await ethers.getContractFactory("MockERC20");
    const usdc = await MockUSDC.deploy("USD Coin", "USDC", 6);
    await usdc.waitForDeployment();
    deployments.usdc = await usdc.getAddress();
    console.log(`${colors.green}✅ USDC deployed at: ${deployments.usdc}${colors.reset}\n`);

    // Mint USDC for testing
    console.log(`${colors.yellow}💵 Minting USDC for testing...${colors.reset}`);
    await usdc.mint(deployer.address, ethers.parseUnits("10000000", 6)); // 10M to deployer
    await usdc.mint(lpProvider.address, ethers.parseUnits("2000000", 6)); // 2M to LP provider
    console.log(`${colors.green}✅ USDC minted${colors.reset}\n`);

    // ========================================
    // 2. Deploy Oracle Infrastructure
    // ========================================
    console.log(`${colors.bright}2. Deploying Oracle Infrastructure...${colors.reset}`);

    // Deploy MarketStatusOracle
    const MarketStatusOracle = await ethers.getContractFactory("MarketStatusOracle");
    const marketStatusOracle = await MarketStatusOracle.deploy();
    await marketStatusOracle.waitForDeployment();
    deployments.marketStatusOracle = await marketStatusOracle.getAddress();
    console.log(`${colors.green}✅ MarketStatusOracle deployed at: ${deployments.marketStatusOracle}${colors.reset}`);

    // Deploy TSLAOracleManager
    const TSLAOracleManager = await ethers.getContractFactory("TSLAOracleManager");

    const tslaOracle = await TSLAOracleManager.deploy(
        CONFIG.oracleWindowSize,
        deployments.marketStatusOracle,
        
    );
    await tslaOracle.waitForDeployment();
    deployments.tslaOracle = await tslaOracle.getAddress();
    console.log(`${colors.green}✅ TSLAOracleManager deployed at: ${deployments.tslaOracle}${colors.reset}`);

    // Deploy AAPLOracleManager
    const AAPLOracleManager = await ethers.getContractFactory("AAPLOracleManager");
    const aaplOracle = await AAPLOracleManager.deploy(
        CONFIG.oracleWindowSize
    );
    await aaplOracle.waitForDeployment();
    deployments.aaplOracle = await aaplOracle.getAddress();
    console.log(`${colors.green}✅ AAPLOracleManager deployed at: ${deployments.aaplOracle}${colors.reset}`);

    // Deploy ChainlinkManager
    const ChainlinkManager = await ethers.getContractFactory("ChainlinkManager");
    const chainlinkManager = await ChainlinkManager.deploy(
      deployments.tslaOracle,
      deployments.aaplOracle,
      deployments.marketStatusOracle
    );
    await chainlinkManager.waitForDeployment();
    deployments.chainlinkManager = await chainlinkManager.getAddress();
    console.log(`${colors.green}✅ ChainlinkManager deployed at: ${deployments.chainlinkManager}${colors.reset}\n`);

    // ========================================
    // 3. Deploy Core Protocol Contracts
    // ========================================
    console.log(`${colors.bright}3. Deploying Core Protocol Contracts...${colors.reset}`);

    // Deploy LiquidityPool
    const LiquidityPool = await ethers.getContractFactory("LiquidityPool");
    const liquidityPool = await LiquidityPool.deploy(deployments.usdc);
    await liquidityPool.waitForDeployment();
    deployments.liquidityPool = await liquidityPool.getAddress();
    console.log(`${colors.green}✅ LiquidityPool deployed at: ${deployments.liquidityPool}${colors.reset}`);

    // Deploy Vault (without feeReceiver in constructor - will set later)
    const Vault = await ethers.getContractFactory("Vault");
    const vault = await Vault.deploy(
      deployments.usdc,
      deployer.address,
      deployments.chainlinkManager
    );
    await vault.waitForDeployment();
    deployments.vault = await vault.getAddress();
    console.log(`${colors.green}✅ Vault deployed at: ${deployments.vault}${colors.reset}`);

    // Deploy PerpEngine
    const PerpEngine = await ethers.getContractFactory("PerpEngine");
    const perpEngine = await PerpEngine.deploy(
      deployments.usdc,
      deployments.liquidityPool,
      deployments.chainlinkManager,
      deployments.vault,
      feeReceiver.address
    );
    await perpEngine.waitForDeployment();
    deployments.perpEngine = await perpEngine.getAddress();
    console.log(`${colors.green}✅ PerpEngine deployed at: ${deployments.perpEngine}${colors.reset}\n`);

    // ========================================
    // 4. Deploy Synthetic Assets
    // ========================================
    console.log(`${colors.bright}4. Deploying Synthetic Assets...${colors.reset}`);

    // Deploy sTSLA
    const STSLA = await ethers.getContractFactory("sTSLA");
    const sTSLA = await STSLA.deploy();
    await sTSLA.waitForDeployment();
    deployments.sTSLA = await sTSLA.getAddress();
    console.log(`${colors.green}✅ sTSLA deployed at: ${deployments.sTSLA}${colors.reset}`);

    // Deploy sAPPL
    const SAPPL = await ethers.getContractFactory("sAPPL");
    const sAPPL = await SAPPL.deploy();
    await sAPPL.waitForDeployment();
    deployments.sAPPL = await sAPPL.getAddress();
    console.log(`${colors.green}✅ sAPPL deployed at: ${deployments.sAPPL}${colors.reset}\n`);

    console.log(`${colors.bright}4.5. Verifying Contract Deployments...${colors.reset}`);
    
    // Verify all contracts are properly deployed
    const contracts = {
      'USDC': deployments.usdc,
      'LiquidityPool': deployments.liquidityPool,
      'Vault': deployments.vault,
      'PerpEngine': deployments.perpEngine,
      'sTSLA': deployments.sTSLA,
      'sAPPL': deployments.sAPPL,
      'ChainlinkManager': deployments.chainlinkManager
    };
    
    for (const [name, address] of Object.entries(contracts)) {
      const code = await ethers.provider.getCode(address);
      if (code === '0x') {
        throw new Error(`${name} contract not deployed properly at ${address}`);
      }
      console.log(`✅ ${name}: ${address} (deployed)`);
    }
    
    // Test contract interactions
    console.log("\nTesting basic contract calls...");
    
    try {
      // Test LiquidityPool methods exist
      const liquidityPoolContract = await ethers.getContractAt("LiquidityPool", deployments.liquidityPool);
      console.log("LiquidityPool contract instance created");
      
      // Test if the methods exist
      const usdcAddress = await liquidityPoolContract.usdc();
      console.log(`LiquidityPool.usdc(): ${usdcAddress}`);
      
      const totalLiq = await liquidityPoolContract.totalLiquidity();
      console.log(`LiquidityPool.totalLiquidity(): ${totalLiq}`);
      
    } catch (testError) {
      console.log(`${colors.red}❌ Contract interaction test failed:${colors.reset}`, testError);
      throw testError;
    }
    
    console.log(`${colors.green}✅ All contracts verified and functional${colors.reset}\n`);

    // ========================================
    // 5. Configure Permissions and Links
    // ========================================
    console.log(`${colors.bright}5. Configuring Permissions...${colors.reset}`);

    // Set Vault address in synthetic tokens
    console.log("Setting vault permissions for synthetic tokens...");
    await sTSLA.setVault(deployments.vault);
    await sAPPL.setVault(deployments.vault);
    console.log(`${colors.green}✅ Synthetic tokens configured${colors.reset}`);

    // Configure LiquidityPool with detailed debugging
    console.log("Configuring LiquidityPool...");
    console.log(`About to set perpMarket to: ${deployments.perpEngine}`);
    console.log(`About to set vault to: ${deployments.vault}`);
    
    // Check LiquidityPool before configuration
    let perpMarketBefore = await liquidityPool.perpMarket();
    let vaultBefore = await liquidityPool.vault();
    console.log(`LiquidityPool perpMarket BEFORE: ${perpMarketBefore}`);
    console.log(`LiquidityPool vault BEFORE: ${vaultBefore}`);
    
    try {
      // Set perpMarket
      console.log("Setting perpMarket...");
      const setPerpTx = await liquidityPool.setPerpMarket(deployments.perpEngine);
      await setPerpTx.wait();
      console.log("setPerpMarket transaction completed");
      
      // Set vault
      console.log("Setting vault...");
      const setVaultTx = await liquidityPool.setVault(deployments.vault);
      await setVaultTx.wait();
      console.log("setVault transaction completed");
      
    } catch (configError) {
      console.log(`${colors.red}❌ Configuration failed:${colors.reset}`, configError);
      throw configError;
    }
    
    // Check LiquidityPool after configuration
    let perpMarketAfter = await liquidityPool.perpMarket();
    let vaultAfter = await liquidityPool.vault();
    console.log(`LiquidityPool perpMarket AFTER: ${perpMarketAfter}`);
    console.log(`LiquidityPool vault AFTER: ${vaultAfter}`);
    
    // Verify the values were actually set
    if (perpMarketAfter === ethers.ZeroAddress) {
      throw new Error("setPerpMarket failed - still zero address");
    }
    if (vaultAfter === ethers.ZeroAddress) {
      throw new Error("setVault failed - still zero address");
    }
    
    console.log(`${colors.green}✅ LiquidityPool configured successfully${colors.reset}`);

    // Configure Vault
    console.log("Configuring Vault...");
    try {
      await vault.setFeeReceiver(feeReceiver.address);
      console.log("setFeeReceiver completed");
      
      await vault.setPerpEngine(deployments.perpEngine);
      console.log("setPerpEngine completed");
      
      await vault.startUpProtocol(
        deployments.sTSLA,
        deployments.sAPPL,
        deployments.perpEngine
      );
      console.log("startUpProtocol completed");
      
    } catch (vaultError) {
      console.log(`${colors.red}❌ Vault configuration failed:${colors.reset}`, vaultError);
      throw vaultError;
    }
    console.log(`${colors.green}✅ Vault configured${colors.reset}`);

    // Configure PerpEngine
    console.log("Configuring PerpEngine...");
    try {
      await perpEngine.setVaultAddress(deployments.vault);
      console.log("setVaultAddress completed");
    } catch (perpError) {
      console.log(`${colors.red}❌ PerpEngine configuration failed:${colors.reset}`, perpError);
      throw perpError;
    }
    console.log(`${colors.green}✅ PerpEngine configured${colors.reset}\n`);
    
    // ========================================
    // 6. Initialize Liquidity Pool
    // ========================================
    console.log(`${colors.bright}6. Initializing Liquidity Pool...${colors.reset}`);

    // Verify LiquidityPool configuration
    const perpMarketAddress = await liquidityPool.perpMarket();
    const vaultAddress = await liquidityPool.vault();
    console.log(`LiquidityPool perpMarket: ${perpMarketAddress}`);
    console.log(`LiquidityPool vault: ${vaultAddress}`);

    // Verify configuration is correct
    if (perpMarketAddress === ethers.ZeroAddress) {
      throw new Error("LiquidityPool perpMarket not set");
    }
    if (vaultAddress === ethers.ZeroAddress) {
      throw new Error("LiquidityPool vault not set");
    }

    // Check LP Provider balance
    const lpBalance = await usdc.balanceOf(lpProvider.address);
    console.log(`LP Provider USDC balance: ${ethers.formatUnits(lpBalance, 6)} USDC`);
    console.log(`Amount to deposit: ${ethers.formatUnits(CONFIG.initialLiquidityUSDC, 6)} USDC`);

    if (lpBalance < CONFIG.initialLiquidityUSDC) {
      throw new Error("Insufficient USDC balance for LP provider");
    }

    // Approve USDC spending
    console.log("Approving USDC...");
    const approvalTx = await usdc.connect(lpProvider).approve(
      deployments.liquidityPool,
      CONFIG.initialLiquidityUSDC
    );
    await approvalTx.wait();

    // Verify approval
    const allowance = await usdc.allowance(lpProvider.address, deployments.liquidityPool);
    console.log(`Verified allowance: ${ethers.formatUnits(allowance, 6)} USDC`);

    if (allowance < CONFIG.initialLiquidityUSDC) {
      throw new Error(`Insufficient allowance: ${ethers.formatUnits(allowance, 6)} < ${ethers.formatUnits(CONFIG.initialLiquidityUSDC, 6)}`);
    }

    // Now attempt the deposit
    console.log("Attempting deposit...");
    try {
      const depositTx = await liquidityPool.connect(lpProvider).deposit(CONFIG.initialLiquidityUSDC);
      await depositTx.wait();
      console.log(`${colors.green}✅ Successfully deposited ${ethers.formatUnits(CONFIG.initialLiquidityUSDC, 6)} USDC${colors.reset}\n`);
    } catch (error) {
      console.log(`${colors.red}❌ Deposit failed${colors.reset}`);
      console.log("Error:", error.message);
      
      // Try static call for better error info
      try {
        await liquidityPool.connect(lpProvider).deposit.staticCall(CONFIG.initialLiquidityUSDC);
      } catch (staticError) {
        console.log("Static call error:", staticError.message);
      }
      throw error;
    }

    // ========================================
    // 7. Initialize Oracle Prices (Mock for testing)
    // ========================================
    console.log(`${colors.bright}7. Setting Initial Oracle Prices (Mock)...${colors.reset}`);
    
    // For mainnet, you'd trigger actual oracle updates
    // For testing, we'll use mock prices if available
    if (process.env.NETWORK === "localhost" || process.env.NETWORK === "hardhat") {
      console.log(`${colors.yellow}⚠️  Using mock prices for testing${colors.reset}`);
      // If you have mock oracle contracts, set prices here
      // await mockChainlinkManager.setPrice(0, ethers.parseUnits("450", 18)); // TSLA
      // await mockChainlinkManager.setPrice(1, ethers.parseUnits("175", 18)); // AAPL
    } else {
      console.log(`${colors.yellow}⚠️  Remember to trigger oracle updates with Chainlink subscription${colors.reset}`);
    }

    // ========================================
    // 8. Verify Configuration
    // ========================================
    console.log(`\n${colors.bright}8. Verifying Deployment...${colors.reset}`);
    
    // Check LiquidityPool state
    const totalLiquidity = await liquidityPool.totalLiquidity();
    const availableLiquidity = await liquidityPool.availableLiquidity();
    console.log(`LiquidityPool - Total: ${ethers.formatUnits(totalLiquidity, 6)} USDC`);
    console.log(`LiquidityPool - Available: ${ethers.formatUnits(availableLiquidity, 6)} USDC`);
    
    // Check Vault configuration
    const vaultContract = await ethers.getContractAt("Vault", deployments.vault);
    const isStarted = await vaultContract.isStarted();
    console.log(`Vault - Started: ${isStarted}`);
    
    // ========================================
    // 9. Save Deployment Addresses
    // ========================================
    console.log(`\n${colors.bright}9. Saving Deployment Info...${colors.reset}`);
    
    const deploymentInfo = {
      network: network.name,
      chainId: network.config.chainId,
      deployer: deployer.address,
      timestamp: new Date().toISOString(),
      contracts: deployments,
      configuration: {
        initialLiquidityUSDC: CONFIG.initialLiquidityUSDC.toString(),
        oracleWindowSize: CONFIG.oracleWindowSize,
        feeReceiver: feeReceiver.address,
        lpProvider: lpProvider.address
      }
    };

    const deploymentPath = path.join(__dirname, `../deployments/${network.name}_deployment.json`);
    fs.mkdirSync(path.dirname(deploymentPath), { recursive: true });
    fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
    
    console.log(`${colors.green}✅ Deployment info saved to: ${deploymentPath}${colors.reset}`);

    // ========================================
    // 10. Summary
    // ========================================
    console.log(`\n${colors.cyan}${'='.repeat(50)}${colors.reset}`);
    console.log(`${colors.bright}DEPLOYMENT SUCCESSFUL!${colors.reset}`);
    console.log(`${colors.cyan}${'='.repeat(50)}${colors.reset}\n`);
    
    console.log(`${colors.bright}Key Addresses:${colors.reset}`);
    console.log(`USDC: ${deployments.usdc}`);
    console.log(`LiquidityPool: ${deployments.liquidityPool}`);
    console.log(`Vault: ${deployments.vault}`);
    console.log(`PerpEngine: ${deployments.perpEngine}`);
    console.log(`sTSLA: ${deployments.sTSLA}`);
    console.log(`sAPPL: ${deployments.sAPPL}`);
    console.log(`ChainlinkManager: ${deployments.chainlinkManager}`);

    return deployments;

  } catch (error) {
    console.error(`\n${colors.red}❌ Deployment failed:${colors.reset}`, error);
    process.exit(1);
  }
}

// Execute deployment
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });