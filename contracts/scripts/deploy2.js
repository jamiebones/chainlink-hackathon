const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

//This should deploy to the source chain (Ethereum Sepolia Testnet) and set up the receiver contract on the destination chain (Avalanche Fuji Testnet).
// Color codes for console output
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  cyan: "\x1b[36m"
};

const receiverContractAddress = "0x60D5A7f7f49D307e36AadAd994EF2e164a42BA54";  //address of the receiver contract on Fuji

//const { router, donId, gasLimit } = network.config;

const linkAddressEthereumSepolia = "0x779877A7B0D9E8603169DdbD7836e478b4624789";
const usdcAddressEthereumSepolia = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";

const destinationChainSelector = 14767482510784806043n;  //Avalanche Fuji Testnet

const ethereumSepoliaRouterAddress = "0x0BF3dE8c5D3e8A2B34D2BEeB17ABfCeBaf363A59"; //Ethereum Sepolia Testnet Router
const gasLimit = 1_000_000; // Adjust as needed

// Deployment configuration
const CONFIG = {
  // Chainlink subscription IDs (update for your network)
  chainlinkSubscriptionId: 15656, // Update with your subscription ID

  // Initial liquidity amounts
  initialLiquidityUSDC: ethers.parseUnits("100000000000", 6), // 100000000000 USDC

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

  const deployer = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, ethers.provider);
  

  console.log(`${colors.yellow}📍 Network: ${network.name}${colors.reset}`);

  console.log(`${colors.yellow}📍 Deployer address: ${deployer.address}${colors.reset}`);
  const provider = new ethers.JsonRpcProvider(`https://sepolia.infura.io/v3/${process.env.INFURA_API_KEY}`);
  // Check deployer balance
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`${colors.yellow}💰 Deployer balance: ${ethers.formatEther(balance)} ETH${colors.reset}\n`);

  // Object to store all deployed addresses
  const deployments = {};

  try {

    // ========================================
    // 1. Deploy Core Protocol Contracts
    // ========================================
    console.log(`${colors.bright}3. Deploying Core Protocol Contracts...${colors.reset}`);
    

    const VaultContractSender = await ethers.getContractFactory("VaultContractSender");
    const vaultContractSender = await VaultContractSender.deploy(
      ethereumSepoliaRouterAddress,
      usdcAddressEthereumSepolia,
      linkAddressEthereumSepolia
    );
    //address _router, address _usdcToken, address _linkTokenAddress
    await vaultContractSender.waitForDeployment();
    deployments.vaultContractSender = await vaultContractSender.getAddress();
    console.log(`${colors.green}✅ VaultContractSender deployed at: ${deployments.vaultContractSender}${colors.reset}\n`);

    // ========================================
    // 2. Set up Vault Contract Destinator
    // ========================================

    try {
      const vaultContractSource = await ethers.getContractAt("VaultContractSource", deployments.vaultContractSender);
      const txn = await vaultContractSource.connect(deployer).setReceiverForDestinationChain(
        destinationChainSelector, //Fuji
        receiverContractAddress //Fuji
      );
      await txn.wait();
      await vaultContractSource.connect(deployer).setGasLimitForDestinationChain(
        destinationChainSelector,
        gasLimit)
    } catch (error) {
      console.log("error when setting destination chain")
    }

    // ========================================
    // 3. Configure Permissions and For Vault Contract Sender
    // ========================================
    console.log(`${colors.bright}5. Configuring Permissions...${colors.reset}`);

    console.log("setting vault permissions for vault contract sender...");
    let tx = await vaultContractSender.connect(deployer).setReceiverForDestinationChain(
      destinationChainSelector,
      receiverContractAddress)
    await tx.wait();

    console.log("successfully set vault permissions for vault contract sender");

    console.log("Setting gas limit for destination chain...");
    tx = await vaultContractSender.connect(deployer).setGasLimitForDestinationChain(
      destinationChainSelector,
      gasLimit
    )
    await tx.wait();
    // Verify all contracts are properly deployed
    const contracts = {
      'Vault contract sender': deployments.vaultContractSender
    };

    for (const [name, address] of Object.entries(contracts)) {
      const code = await ethers.provider.getCode(address);
      if (code === '0x') {
        throw new Error(`${name} contract not deployed properly at ${address}`);
      }
      console.log(`✅ ${name}: ${address} (deployed)`);
    }

    // ========================================
    // 4. Save Deployment Addresses
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
      }
    };

    const deploymentPath = path.join(__dirname, `../deployments/${network.name}_deployment.json`);
    fs.mkdirSync(path.dirname(deploymentPath), { recursive: true });
    fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));

    console.log(`${colors.green}✅ Deployment info saved to: ${deploymentPath}${colors.reset}`);

    // ========================================
    // 5. Summary
    // ========================================
    console.log(`\n${colors.cyan}${'='.repeat(50)}${colors.reset}`);
    console.log(`${colors.bright}DEPLOYMENT SUCCESSFUL!${colors.reset}`);
    console.log(`${colors.cyan}${'='.repeat(50)}${colors.reset}\n`);

    console.log(`${colors.bright}Key Addresses:${colors.reset}`);
    console.log(`Vault Contract Sender: ${deployments.vaultContractSender}`);
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