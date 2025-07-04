const { ethers } = require("hardhat");
require("dotenv").config();

const erc20TokenAbi = [
    "function balanceOf(address account) view returns (uint256)",
    "function transfer(address to, uint256 amount) returns (bool)",
    "function approve(address spender, uint256 amount) returns (bool)",
    "function allowance(address owner, address spender) view returns (uint256)"
];


const deployer = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, ethers.provider);
const usdcAddressAvalancheFuji = "0x5425890298aed601595a70AB815c96711a31Bc65"


const allowance = ethers.parseEther("10000000000");


async function main() {
    console.log("🚀 Starting Vault Position Opening Script\n");

    // Setup provider and contracts
    const provider = new ethers.JsonRpcProvider(`https://avalanche-fuji.infura.io/v3/${process.env.INFURA_API_KEY}`);
    const vaultAddress = "0xa7d23A3828019976F5bdA0e2a6075F61fAbEF8b2";

    // Create contract instances
    const usdcContract = new ethers.Contract(usdcAddressAvalancheFuji, erc20TokenAbi, provider);
    const vaultContract = await ethers.getContractAt("Vault", vaultAddress);

    // Connect deployer to provider
    const deployerWithProvider = deployer.connect(provider);

    console.log(`Deployer address: ${deployer.address}`);
    console.log(`Vault address: ${vaultAddress}`);
    console.log(`USDC address: ${usdcAddressAvalancheFuji}\n`);

    // Check deployer's USDC balance
    const deployerBalance = await usdcContract.balanceOf(deployer.address);
    console.log(`Deployer USDC balance: ${ethers.formatUnits(deployerBalance, 6)} USDC`);

    // Check current allowance
    const currentAllowance = await usdcContract.allowance(deployer.address, vaultAddress);
    console.log(`Current allowance: ${ethers.formatUnits(currentAllowance, 6)} USDC`);

    // Set allowance if needed (approve vault to spend USDC)
    const requiredAllowance = ethers.parseUnits("1000", 6); // 1000 USDC allowance

    if (currentAllowance < requiredAllowance) {
        console.log(`\n📝 Setting USDC allowance for vault contract...`);
        console.log(`Approving ${ethers.formatUnits(requiredAllowance, 6)} USDC`);

        try {
            const approveTx = await usdcContract.connect(deployerWithProvider).approve(
                vaultAddress,
                requiredAllowance
            );
            console.log(`Approval transaction hash: ${approveTx.hash}`);

            const approveReceipt = await approveTx.wait();
            console.log(`✅ Approval confirmed in block ${approveReceipt.blockNumber}`);

            // Verify allowance was set
            const newAllowance = await usdcContract.allowance(deployer.address, vaultAddress);
            console.log(`New allowance: ${ethers.formatUnits(newAllowance, 6)} USDC`);

        } catch (approveError) {
            console.error("❌ Approval failed:", approveError.message);
            return;
        }
    } else {
        console.log("✅ Sufficient allowance already exists");
    }

    // Check if protocol is started
    console.log("\n🔍 Checking protocol status...");
    try {
        const isStarted = await vaultContract.isStarted();
        console.log(`Protocol started: ${isStarted}`);

        if (!isStarted) {
            console.error("❌ Protocol is not started. Cannot open positions.");
            return;
        }
    } catch (error) {
        console.error("❌ Failed to check protocol status:", error.message);
        return;
    }

    // Define position parameters
    const assetType = 0; // 0 = TSLA, 1 = APPL
    const numShares = ethers.parseUnits("0.00002", 18); // 1 share (18 decimals)

    console.log(`\n📊 Position Parameters:`);
    console.log(`Asset Type: ${assetType} (${assetType === 0 ? 'TSLA' : 'APPL'})`);
    console.log(`Number of Shares: ${ethers.formatUnits(numShares, 18)} shares`);

    // Test the openPosition call with static call first
    console.log("\n🧪 Testing openPosition with static call...");

    try {
        await vaultContract.connect(deployerWithProvider)
            .openPosition.staticCall(assetType, numShares);
        console.log("✅ Static call succeeded - transaction should work");
    } catch (staticError) {
        console.log("❌ Static call failed:");
        console.log("Error message:", staticError.message);

        if (staticError.data) {
            console.log("Error data:", staticError.data);

            // Try to decode common errors
            const commonErrors = [
                "error NotStarted()",
                "error InvalidAssetTypeUsed()",
                "error InsufficientFundForPayout()",
                "error TransferofFundsFailed()",
                "error ZeroAmount()",
                "error InvalidPosition()",
                "error MarketPaused()",
                "error FeeIsGreaterThanCollateral()"
            ];

            try {
                const iface = new ethers.Interface(commonErrors);
                const decodedError = iface.parseError(staticError.data);
                console.log("Decoded error:", decodedError.name);
                if (decodedError.args && decodedError.args.length > 0) {
                    console.log("Error arguments:", decodedError.args);
                }
            } catch (decodeError) {
                console.log("Could not decode error:", decodeError.message);
            }
        }

        console.log("\n❌ Cannot proceed with transaction due to static call failure");
        return;
    }

    // Execute the actual openPosition transaction
    console.log("\n🚀 Executing openPosition transaction...");

    try {
        const openPositionTx = await vaultContract.connect(deployerWithProvider)
            .openPosition(assetType, numShares);

        console.log(`Transaction hash: ${openPositionTx.hash}`);
        console.log("Waiting for confirmation...");

        const receipt = await openPositionTx.wait();
        console.log(`✅ Transaction confirmed in block ${receipt.blockNumber}`);
        console.log(`Gas used: ${receipt.gasUsed.toString()}`);

        // Check the result
        console.log("\n🎉 Position opened successfully!");
        console.log(`Transaction hash: ${openPositionTx.hash}`);

        // You can add additional checks here like:
        // - Check synthetic token balance
        // - Check vault position count
        // - etc.

    } catch (error) {
        console.error("❌ Transaction failed:");
        console.error("Error message:", error.message);

        if (error.data) {
            console.error("Error data:", error.data);
        }

        if (error.transaction) {
            console.error("Transaction details:", error.transaction);
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("Script failed:", error);
        process.exit(1);
    });

