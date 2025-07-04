const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");
const { config } = require("dotenv");
require("dotenv").config();

const { router, donId, gasLimit } = network.config;

// Deployment configuration
const CONFIG = {
  chainlinkSubscriptionId: 15608,
  initialLiquidityUSDC: ethers.parseUnits("1000", 6), // 1000 USDC
  oracleWindowSize: 60,
  lpShare: 7000, // 70%
  protocolShare: 3000, // 30%
};

// Helper function to execute transactions with proper nonce management
async function executeTransaction(txPromise, description, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      console.log(`Executing ${description}... (attempt ${i + 1}/${retries})`);
      
      const tx = await txPromise;
      console.log(`Transaction sent: ${tx.hash}`);
      
      const receipt = await tx.wait();
      console.log(`✅ ${description} completed (Gas used: ${receipt.gasUsed})`);
      
      // Add small delay to prevent nonce issues
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      return receipt;
      
    } catch (error) {
      console.error(`❌ Attempt ${i + 1} failed for ${description}: ${error.message}`);
      
      if (error.message.includes("nonce too low") || error.message.includes("nonce")) {
        console.log("Nonce issue detected, waiting 5 seconds before retry...");
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
      
      if (i === retries - 1) throw error;
      
      console.log("Retrying in 3 seconds...");
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }
}

async function main() {
  console.log("🚀 Starting Synthetic Equity Protocol Deployment\n");

  if (!process.env.LP_PROVIDER_PRIVATE_KEY || !process.env.FEE_RECEIVER_PRIVATE_KEY) {
    console.warn("⚠️  One or more private keys are missing in .env — falling back to DEPLOYER key");
  }

  const deployer = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, ethers.provider);
  const lpProvider = new ethers.Wallet(process.env.LP_PROVIDER_PRIVATE_KEY || process.env.DEPLOYER_PRIVATE_KEY, ethers.provider);
  const feeReceiver = new ethers.Wallet(process.env.FEE_RECEIVER_PRIVATE_KEY || process.env.DEPLOYER_PRIVATE_KEY, ethers.provider);
  const executor = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, ethers.provider);

  console.log(`Network: ${network.name}`);
  console.log(`Deployer address: ${deployer.address}`);
  console.log(`LP Provider address: ${lpProvider.address}`);
  console.log(`Fee Receiver address: ${feeReceiver.address}\n`);

  // Check deployer balance
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Deployer balance: ${ethers.formatEther(balance)} ETH\n`);

  const deployments = {};

  try {
    // 1. Deploy Mock USDC
    console.log("1. Deploying USDC...");
    const MockUSDC = await ethers.getContractFactory("MockERC20");
    const usdc = await MockUSDC.deploy("USD Coin", "USDC", 6);
    await usdc.waitForDeployment();
    deployments.usdc = await usdc.getAddress();
    console.log(`✅ USDC deployed at: ${deployments.usdc}\n`);

    // Mint USDC for testing
    console.log("💵 Minting USDC for testing...");
    await executeTransaction(
      usdc.mint(deployer.address, ethers.parseUnits("10000000", 6)),
      "USDC mint to deployer"
    );
    await executeTransaction(
      usdc.mint(lpProvider.address, ethers.parseUnits("2000000", 6)),
      "USDC mint to LP provider"
    );
    console.log("✅ USDC minted\n");

    // 2. Deploy Oracle Infrastructure
    console.log("2. Deploying Oracle Infrastructure...");
    
    // Deploy MarketStatusOracle
    const MarketStatusOracle = await ethers.getContractFactory("MarketStatusOracle");
    const marketStatusOracle = await MarketStatusOracle.deploy();
    await marketStatusOracle.waitForDeployment();
    deployments.marketStatusOracle = await marketStatusOracle.getAddress();
    console.log(`✅ MarketStatusOracle deployed at: ${deployments.marketStatusOracle}`);

    // Deploy TSLAOracleManager
    const TSLAOracleManager = await ethers.getContractFactory("TSLAOracleManager");
    const tslaOracle = await TSLAOracleManager.deploy(
        CONFIG.oracleWindowSize,
        deployments.marketStatusOracle
    );
    await tslaOracle.waitForDeployment();
    deployments.tslaOracle = await tslaOracle.getAddress();
    console.log(`✅ TSLAOracleManager deployed at: ${deployments.tslaOracle}`);

    // Deploy AAPLOracleManager
    const AAPLOracleManager = await ethers.getContractFactory("AAPLOracleManager");
    const aaplOracle = await AAPLOracleManager.deploy(
        CONFIG.oracleWindowSize
    );
    await aaplOracle.waitForDeployment();
    deployments.aaplOracle = await aaplOracle.getAddress();
    console.log(`✅ AAPLOracleManager deployed at: ${deployments.aaplOracle}`);

    // Deploy ChainlinkManager
    const ChainlinkManager = await ethers.getContractFactory("ChainlinkManager");
    const chainlinkManager = await ChainlinkManager.deploy(
      deployments.tslaOracle,
      deployments.aaplOracle,
      deployments.marketStatusOracle
    );
    await chainlinkManager.waitForDeployment();
    deployments.chainlinkManager = await chainlinkManager.getAddress();
    console.log(`✅ ChainlinkManager deployed at: ${deployments.chainlinkManager}\n`);

    // 3. Deploy Core Protocol Contracts
    console.log("3. Deploying Core Protocol Contracts...");
    
    // Deploy LiquidityPool
    const LiquidityPool = await ethers.getContractFactory("LiquidityPool");
    const liquidityPool = await LiquidityPool.deploy(deployments.usdc);
    await liquidityPool.waitForDeployment();
    deployments.liquidityPool = await liquidityPool.getAddress();
    console.log(`✅ LiquidityPool deployed at: ${deployments.liquidityPool}`);

    // Deploy Vault
    const Vault = await ethers.getContractFactory("Vault");
    const vault = await Vault.deploy(
      deployments.usdc,
      deployer.address,
      deployments.chainlinkManager
    );
    await vault.waitForDeployment();
    deployments.vault = await vault.getAddress();
    console.log(`✅ Vault deployed at: ${deployments.vault}`);

    // Deploy PerpEngine
    const PerpEngine = await ethers.getContractFactory("PerpEngine");
    const perpEngine = await PerpEngine.deploy(
      deployments.usdc,
      deployments.liquidityPool,
      deployments.chainlinkManager,
      deployments.vault,
      feeReceiver.address,
      executor.address
    );
    await perpEngine.waitForDeployment();
    deployments.perpEngine = await perpEngine.getAddress();
    console.log(`✅ PerpEngine deployed at: ${deployments.perpEngine}`);

    const PerpEngineZk = await ethers.getContractFactory("PerpEngineZk");
    const perpEngineZk = await PerpEngineZk.deploy(
      deployer.address,  // needs to be updated to verifier
      deployments.perpEngine,
      usdc.getAddress()
    );
    await perpEngineZk.waitForDeployment();
    deployments.perpEngineZk = await perpEngineZk.getAddress();

    console.log(`✅ PerpEngineZk deployed at: ${deployments.perpEngineZk}\n`);

    // 4. Deploy Synthetic Assets
    console.log("4. Deploying Synthetic Assets...");
    
    // Deploy sTSLA
    const STSLA = await ethers.getContractFactory("sTSLA");
    const sTSLA = await STSLA.deploy();
    await sTSLA.waitForDeployment();
    deployments.sTSLA = await sTSLA.getAddress();
    console.log(`✅ sTSLA deployed at: ${deployments.sTSLA}`);

    // Deploy sAPPL
    const SAPPL = await ethers.getContractFactory("sAPPL");
    const sAPPL = await SAPPL.deploy();
    await sAPPL.waitForDeployment();
    deployments.sAPPL = await sAPPL.getAddress();
    console.log(`✅ sAPPL deployed at: ${deployments.sAPPL}\n`);

    // 4.5. Verify Contract Deployments
    console.log("4.5. Verifying Contract Deployments...");
    
    const contracts = {
      'USDC': deployments.usdc,
      'LiquidityPool': deployments.liquidityPool,
      'Vault': deployments.vault,
      'PerpEngine': deployments.perpEngine,
      'PerpEngineZk': deployments.perpEngineZk,
      'sTSLA': deployments.sTSLA,
      'sAPPL': deployments.sAPPL,
      'ChainlinkManager': deployments.chainlinkManager,
      'MarketStatusOracle': deployments.marketStatusOracle,
      'TSLAOracleManager': deployments.tslaOracle,
      'AAPLOracleManager': deployments.aaplOracle
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
      const liquidityPoolContract = await ethers.getContractAt("LiquidityPool", deployments.liquidityPool);
      console.log("LiquidityPool contract instance created");
      
      const usdcAddress = await liquidityPoolContract.usdc();
      console.log(`LiquidityPool.usdc(): ${usdcAddress}`);
      
      const totalLiq = await liquidityPoolContract.totalLiquidity();
      console.log(`LiquidityPool.totalLiquidity(): ${totalLiq}`);
      
    } catch (testError) {
      console.log("❌ Contract interaction test failed:", testError);
      throw testError;
    }
    
    console.log("✅ All contracts verified and functional\n");

    // 5. Configure Permissions and Links
    console.log("5. Configuring Permissions...");
    
    // Set Vault address in synthetic tokens
    console.log("Setting vault permissions for synthetic tokens...");
    await executeTransaction(
      sTSLA.setVault(deployments.vault),
      "sTSLA setVault"
    );
    await executeTransaction(
      sAPPL.setVault(deployments.vault),
      "sAPPL setVault"
    );
    console.log("✅ Synthetic tokens configured");

    // Configure LiquidityPool
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
      await executeTransaction(
        liquidityPool.setPerpMarket(deployments.perpEngine),
        "LiquidityPool setPerpMarket"
      );
      
      // Set vault
      console.log("Setting vault...");
      await executeTransaction(
        liquidityPool.setVault(deployments.vault),
        "LiquidityPool setVault"
      );

      console.log("setting perpEngineZk...");
      await executeTransaction(
        perpEngine.setPerpEngineZk(deployments.perpEngineZk),
        "PerpEngine setPerpEngineZk"
      );
      
    } catch (configError) {
      console.log("❌ Configuration failed:", configError);
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
    
    console.log("✅ LiquidityPool configured successfully");

    // Configure Vault
    console.log("Configuring Vault...");
    try {
      await executeTransaction(
        vault.setFeeReceiver(feeReceiver.address),
        "Vault setFeeReceiver"
      );
      
      await executeTransaction(
        vault.setPerpEngine(deployments.perpEngine),
        "Vault setPerpEngine"
      );
      
      await executeTransaction(
        vault.startUpProtocol(
          deployments.sTSLA,
          deployments.sAPPL,
          deployments.perpEngine
        ),
        "Vault startUpProtocol"
      );
      
    } catch (vaultError) {
      console.log("❌ Vault configuration failed:", vaultError);
      throw vaultError;
    }
    console.log("✅ Vault configured");

    // Configure PerpEngine
    console.log("Configuring PerpEngine...");
    try {
      await executeTransaction(
        perpEngine.setVaultAddress(deployments.vault),
        "PerpEngine setVaultAddress"
      );
    } catch (perpError) {
      console.log("❌ PerpEngine configuration failed:", perpError);
      throw perpError;
    }
    console.log("✅ PerpEngine configured\n");
    
    // 6. Initialize Liquidity Pool
    console.log("6. Initializing Liquidity Pool...");
    
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
    await executeTransaction(
      usdc.connect(lpProvider).approve(deployments.liquidityPool, CONFIG.initialLiquidityUSDC),
      "USDC approval for liquidity deposit"
    );

    // Verify approval
    const allowance = await usdc.allowance(lpProvider.address, deployments.liquidityPool);
    console.log(`Verified allowance: ${ethers.formatUnits(allowance, 6)} USDC`);
    
    if (allowance < CONFIG.initialLiquidityUSDC) {
      throw new Error(`Insufficient allowance: ${ethers.formatUnits(allowance, 6)} < ${ethers.formatUnits(CONFIG.initialLiquidityUSDC, 6)}`);
    }

    // Now attempt the deposit
    console.log("Attempting deposit...");
    try {
      await executeTransaction(
        liquidityPool.connect(lpProvider).deposit(CONFIG.initialLiquidityUSDC),
        "Initial liquidity deposit"
      );
      console.log(`✅ Successfully deposited ${ethers.formatUnits(CONFIG.initialLiquidityUSDC, 6)} USDC\n`);
    } catch (error) {
      console.log("❌ Deposit failed");
      console.log("Error:", error.message);
      
      // Try static call for better error info
      try {
        await liquidityPool.connect(lpProvider).deposit.staticCall(CONFIG.initialLiquidityUSDC);
      } catch (staticError) {
        console.log("Static call error:", staticError.message);
      }
      throw error;
    }

    // 7. Initialize Oracle Prices (Mock for testing)
    console.log("7. Setting Initial Oracle Prices (Mock)...");
    
    if (process.env.NETWORK === "localhost" || process.env.NETWORK === "hardhat") {
      console.log("⚠️  Using mock prices for testing");
    } else {
      console.log("⚠️  Remember to trigger oracle updates with Chainlink subscription");
    }

    // 8. Verify Configuration
    console.log("\n8. Verifying Deployment...");
    
    // Check LiquidityPool state
    const totalLiquidity = await liquidityPool.totalLiquidity();
    const availableLiquidity = await liquidityPool.availableLiquidity();
    console.log(`LiquidityPool - Total: ${ethers.formatUnits(totalLiquidity, 6)} USDC`);
    console.log(`LiquidityPool - Available: ${ethers.formatUnits(availableLiquidity, 6)} USDC`);
    
    // Check Vault configuration
    const vaultContract = await ethers.getContractAt("Vault", deployments.vault);
    const isStarted = await vaultContract.isStarted();
    console.log(`Vault - Started: ${isStarted}`);
    
    // 9. Save Deployment Addresses
    console.log("\n9. Saving Deployment Info...");
    
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
    
    console.log(`✅ Deployment info saved to: ${deploymentPath}`);

    // 10. Summary
    console.log("\n" + "=".repeat(50));
    console.log("DEPLOYMENT SUCCESSFUL!");
    console.log("=".repeat(50) + "\n");
    
    console.log("Key Addresses:");
    console.log(`USDC: ${deployments.usdc}`);
    console.log(`LiquidityPool: ${deployments.liquidityPool}`);
    console.log(`Vault: ${deployments.vault}`);
    console.log(`PerpEngine: ${deployments.perpEngine}`);
    console.log(`PerpEngineZk: ${deployments.perpEngineZk}`);
    console.log(`sTSLA: ${deployments.sTSLA}`);
    console.log(`sAPPL: ${deployments.sAPPL}`);
    console.log(`ChainlinkManager: ${deployments.chainlinkManager}`);
    console.log(`MarketStatusOracle: ${deployments.marketStatusOracle}`);
    console.log(`TSLAOracleManager: ${deployments.tslaOracle}`);
    console.log(`AAPLOracleManager: ${deployments.aaplOracle}`);

    return deployments;

  } catch (error) {
    console.error("\n❌ Deployment failed:", error);
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