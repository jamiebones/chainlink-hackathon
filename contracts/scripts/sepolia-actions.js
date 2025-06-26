const { ethers } = require("hardhat");
require("dotenv").config();

const erc20TokenAbi = [
    "function balanceOf(address account) view returns (uint256)",
    "function transfer(address to, uint256 amount) returns (bool)",
    "function approve(address spender, uint256 amount) returns (bool)",
    "function allowance(address owner, address spender) view returns (uint256)"
];

const linkAddressOnSepolia = "0x779877A7B0D9E8603169DdbD7836e478b4624789";
const usdcContractAddressOnSepolia = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";
const deployer = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, ethers.provider);


const fujiDestinationChainSelector = 14767482510784806043n; // Avalanche Fuji testnet chain selector
const receiverContractAddress = "0x60D5A7f7f49D307e36AadAd994EF2e164a42BA54"; //receiver contract address on Fuji
const allowance = ethers.parseEther("10000000000");

const sepoliaSourceContract = "0xC29534f3B12658E58FEf15a454A284eC271C7297"; //vaultContractSender addresss on sepolia

async function main() {
    let tx;
    //get the receiver contract and set the source destination🧮 
    const provider = new ethers.JsonRpcProvider(`https://sepolia.infura.io/v3/${process.env.INFURA_API_KEY}`);
    const linkContract = new ethers.Contract(linkAddressOnSepolia, erc20TokenAbi, provider);
    const usdcContract = new ethers.Contract(usdcContractAddressOnSepolia, erc20TokenAbi, provider);
    //transfer LINKS from the deployer to the source contract;
    const linkBalance = await linkContract.balanceOf(deployer.address);
    console.log("LINK Balance:", ethers.formatEther(linkBalance));
    const amountToTransfer = ethers.parseEther("10");
    if (+linkBalance.toString() < (+amountToTransfer.toString())) {
        console.error("Insufficient LINK balance for transfer.");
        return;
    }
    tx = await linkContract.connect(deployer).transfer(sepoliaSourceContract, amountToTransfer);
    await tx.wait();
    console.log(`Transferred ${ethers.formatEther(amountToTransfer)} LINK to the source contract.`);

    //SET THE DESTINATION 
    const usdcAmountToBuyShares = ethers.parseUnits("2", 6);
    const userUSDCBalance = await usdcContract.balanceOf(deployer.address);
    if (+userUSDCBalance.toString() < (+usdcAmountToBuyShares.toString())) {
        console.error("Insufficient USDC balance to buy shares.");
        return;
    }
    //try the staking method
    let vaultContractSender = await ethers.getContractAt("VaultContractSender", sepoliaSourceContract);
    ////grant allowance to the source contract to spend the deployer USDC
    console.log("granting allowance to the contract to spend USDC")
    tx = await usdcContract.connect(deployer).approve(sepoliaSourceContract, allowance);
    await tx.wait();
    console.log("allowance successful...")
    console.log("opening a position via CCIP...");

    // Construct the struct as aJS object
    const positionRequest = {
        asset: 0,
        amount: usdcAmountToBuyShares,
        recipient: deployer.address,
        fujiChainSelector: fujiDestinationChainSelector,
        fujiReceiver: receiverContractAddress
    };

    tx = await vaultContractSender.openPositionViaCCIP(positionRequest);
    console.log("Transaction hash for CCIP:", tx.hash);
    await tx.wait();
    console.log("Next is to Verify on Fuji if position was opened successfully via CCIP.");
}


main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });