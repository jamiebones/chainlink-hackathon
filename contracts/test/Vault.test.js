const { time, loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { expect } = require("chai");
const { ethers } = require("hardhat");

const Utils = {
    Asset: {
        TSLA: 0,
        APPL: 1,
    }
};

describe("Vault", function () {
    async function deployVaultFixture() {
        const [admin, trader, otherAccount] = await ethers.getSigners();

        // Deploy mock contracts
        const MockUSDC = await ethers.getContractFactory("MockUSDC");
        const mockUSDC = await MockUSDC.deploy();
        await mockUSDC.waitForDeployment();

        const MockAsset = await ethers.getContractFactory("MockAsset");
        const mockSTSLA = await MockAsset.deploy();
        await mockSTSLA.waitForDeployment();
        const mockSAPPL = await MockAsset.deploy();
        await mockSAPPL.waitForDeployment();

        const MockChainlinkManager = await ethers.getContractFactory("MockChainlinkManager");
        const mockChainlinkManager = await MockChainlinkManager.deploy();
        await mockChainlinkManager.waitForDeployment();

        const MockPerpEngine = await ethers.getContractFactory("MockPerpEngine");
        const mockPerpEngine = await MockPerpEngine.deploy();
        await mockPerpEngine.waitForDeployment();

        // Get the addresses
        const usdcAddress = await mockUSDC.getAddress();
        const chainlinkAddress = await mockChainlinkManager.getAddress();
        const perpEngineAddress = await mockPerpEngine.getAddress();
        const sTSLAAddress = await mockSTSLA.getAddress();
        const sAPPLAddress = await mockSAPPL.getAddress();

        // Deploy Vault
        const Vault = await ethers.getContractFactory("Vault");
        const vault = await Vault.deploy(
            usdcAddress,
            admin.address,
            chainlinkAddress
        );
        await vault.waitForDeployment();

        const vaultAddress = await vault.getAddress();

        // Initialize protocol
        await vault.connect(admin).startUpProtocol(
            sTSLAAddress,
            sAPPLAddress,
            perpEngineAddress
        );

        await mockSTSLA.setMinter(vaultAddress);
        await mockSTSLA.setBurner(vaultAddress);
        await mockSAPPL.setMinter(vaultAddress);
        await mockSAPPL.setBurner(vaultAddress);

        // Set initial prices
        await mockChainlinkManager.setPrice(Utils.Asset.TSLA, 100 * 1e8);
        await mockChainlinkManager.setDexPrice(Utils.Asset.TSLA, 99 * 1e8);
        await mockChainlinkManager.setPrice(Utils.Asset.APPL, 150 * 1e8);
        await mockChainlinkManager.setDexPrice(Utils.Asset.APPL, 148 * 1e8);

        // Set market status
        await mockChainlinkManager.setMarketOpen(true);
        await mockChainlinkManager.setPaused(Utils.Asset.TSLA, false);
        await mockChainlinkManager.setPaused(Utils.Asset.APPL, false);

        await mockPerpEngine.setCloseVaultHedgeReturnValue(ethers.parseUnits("1000", 6));

        return {
            vault,
            vaultAddress,
            mockUSDC,
            mockSTSLA,
            mockSAPPL,
            mockChainlinkManager,
            mockPerpEngine,
            admin,
            trader,
            otherAccount
        };
    }

    // Helper function to mint and approve USDC
    async function mintAndApproveUSDC(trader, vaultAddress, mockUSDC, amount) {
        await mockUSDC.connect(trader).mint(trader.address, amount);
        await mockUSDC.connect(trader).approve(vaultAddress, amount);
    }

    // Helper function to calculate required USDC
    async function calculateRequiredUSDC(chainlinkPrice, numShares) {
        const PRECISION = ethers.parseUnits("1", 18);
        const PERCENTAGE_COLLATERAL = ethers.parseUnits("1.1", 18); // 110% in 18 decimals
        const BASE_FEE = ethers.parseUnits("0.005", 18); // 0.5% base fee

        // Chainlink price comes in 8 decimals, scale to 18
        const scaledPrice = chainlinkPrice * BigInt(1e10);

        // Calculate amounts in USD (18 decimals)
        const amountForSharesInUSD = (scaledPrice * numShares) / PRECISION;
        const collateralForSharesInUSD = (amountForSharesInUSD * PERCENTAGE_COLLATERAL) / PRECISION;

        // Calculate mint fee
        const mintFee = (collateralForSharesInUSD * BASE_FEE) / PRECISION;

        // Convert to USDC (6 decimals)
        const collateralInUSDC = collateralForSharesInUSD / 1_000_000_000_000n;
        const mintFeeInUSDC = mintFee / 1_000_000_000_000n;

        // Add buffer and multiply by 3 for safety
        return (collateralInUSDC + mintFeeInUSDC) * 3n;
    }

    // Helper function to open a position
    async function openPosition(vault, mockUSDC, trader, mockChainlinkManager, assetType, numShares) {
        const chainlinkPrice = ethers.parseUnits("100", 18);
        await mockChainlinkManager.setPrice(assetType, chainlinkPrice);

        const requiredUSDC = await calculateRequiredUSDC(chainlinkPrice, numShares);
        await mintAndApproveUSDC(trader, await vault.getAddress(), mockUSDC, requiredUSDC);

        return vault.connect(trader).openPosition(assetType, numShares);
    }

    describe("Deployment", function () {
        it("Should set the right admin", async function () {
            const { vault, admin } = await loadFixture(deployVaultFixture);
            expect(await vault.admin()).to.equal(admin.address);
        });

        it("Should not be started before initialization", async function () {
            const [admin] = await ethers.getSigners();
            const MockUSDC = await ethers.getContractFactory("MockUSDC");
            const mockUSDC = await MockUSDC.deploy();

            const MockChainlinkManager = await ethers.getContractFactory("MockChainlinkManager");
            const mockChainlinkManager = await MockChainlinkManager.deploy();

            const Vault = await ethers.getContractFactory("Vault");
            const vault = await Vault.deploy(
                await mockUSDC.getAddress(),
                admin.address,
                await mockChainlinkManager.getAddress()
            );

            expect(await vault.isStarted()).to.be.false;
        });
    });

    describe("Position Management", function () {
        it("Should open position correctly", async function () {
            const { vault, vaultAddress, mockUSDC, mockSTSLA, trader, mockChainlinkManager } =
                await loadFixture(deployVaultFixture);

            const numShares = ethers.parseUnits("10", 18);
            const assetType = Utils.Asset.TSLA;

            // Set price in CHAINLINK_PRECISION (8 decimals)
            const chainlinkPrice = 100n * BigInt(1e8); // $100 in 8 decimals
            const twapPrice = 99n * BigInt(1e8); // $99 in 8 decimals

            await mockChainlinkManager.setPrice(assetType, chainlinkPrice);
            await mockChainlinkManager.setDexPrice(assetType, twapPrice);

            const requiredUSDC = await calculateRequiredUSDC(chainlinkPrice, numShares);

            // Mint and approve USDC (in 6 decimals)
            await mockUSDC.connect(trader).mint(trader.address, requiredUSDC * 3n);
            await mockUSDC.connect(trader).approve(vaultAddress, requiredUSDC * 3n);

            await expect(vault.connect(trader).openPosition(assetType, numShares))
                .to.emit(vault, "PositionCreated");

            expect(await mockSTSLA.balanceOf(trader.address)).to.equal(numShares);
        });

        it("Should fail to open position with insufficient USDC", async function () {
            const { vault, vaultAddress, mockUSDC, trader, mockChainlinkManager } = await loadFixture(deployVaultFixture);

            const numShares = ethers.parseUnits("10", 18);
            const assetType = Utils.Asset.TSLA;

            // Set price in CHAINLINK_PRECISION (8 decimals)
            const chainlinkPrice = 100n * BigInt(1e8); // $100 in 8 decimals
            await mockChainlinkManager.setPrice(assetType, chainlinkPrice);

            const requiredUSDC = await calculateRequiredUSDC(chainlinkPrice, numShares);

            // Mint and approve a tiny amount of USDC
            await mockUSDC.connect(trader).mint(trader.address, 100); // Very small amount
            await mockUSDC.connect(trader).approve(vaultAddress, 100); // Very small amount

            await expect(vault.connect(trader).openPosition(assetType, numShares))
                .to.be.revertedWithCustomError(vault, "InsufficientFundForPayout");
        });

        it("Should fail to open position with zero shares", async function () {
            const { vault, trader, mockUSDC, mockChainlinkManager } = await loadFixture(deployVaultFixture);
            const numShares = 0;

            await expect(
                vault.connect(trader).openPosition(0, numShares)
            ).to.be.revertedWithCustomError(vault, "InvalidNumberOfShares");
        });

        it("Should fail to open position when market is closed", async function () {
            const { vault, trader, mockUSDC, mockChainlinkManager } = await loadFixture(deployVaultFixture);
            const numShares = ethers.parseUnits("1", 18);

            await mockChainlinkManager.setMarketOpen(false);

            await expect(
                vault.connect(trader).openPosition(0, numShares)
            ).to.be.revertedWithCustomError(vault, "MarketNotOpen");
        });

        it("Should fail to open position when asset is paused", async function () {
            const { vault, trader, mockUSDC, mockChainlinkManager } = await loadFixture(deployVaultFixture);
            const numShares = ethers.parseUnits("1", 18);

            await mockChainlinkManager.setPaused(Utils.Asset.TSLA, true);

            await expect(
                vault.connect(trader).openPosition(Utils.Asset.TSLA, numShares)
            ).to.be.revertedWithCustomError(vault, "CircuitBreakerActivatedForAsset");
        });
    });

    describe("Protocol Startup", function () {
        it("Should initialize assets correctly through position opening", async function () {
            const { vault, vaultAddress, mockUSDC, mockSTSLA, mockSAPPL, trader } = await loadFixture(deployVaultFixture);

            const numShares = ethers.parseUnits("10", 18);

            // Calculate required collateral
            const tslaOraclePrice = ethers.parseUnits("100", 18);
            const tslaCollateral = (tslaOraclePrice * numShares * 110n) / 100n;
            const tslaUSDC = tslaCollateral / 1_000_000_000_000n;

            const applOraclePrice = ethers.parseUnits("150", 18);
            const applCollateral = (applOraclePrice * numShares * 110n) / 100n;
            const applUSDC = applCollateral / 1_000_000_000_000n;

            const totalRequiredUSDC = tslaUSDC + applUSDC;

            // Fund and approve
            await mockUSDC.connect(trader).mint(trader.address, totalRequiredUSDC * 2n);
            await mockUSDC.connect(trader).approve(vaultAddress, totalRequiredUSDC * 2n);

            // Open positions
            await expect(vault.connect(trader).openPosition(Utils.Asset.TSLA, numShares))
                .to.emit(vault, "PositionCreated");
            expect(await mockSTSLA.balanceOf(trader.address)).to.equal(numShares);

            await expect(vault.connect(trader).openPosition(Utils.Asset.APPL, numShares))
                .to.emit(vault, "PositionCreated");
            expect(await mockSAPPL.balanceOf(trader.address)).to.equal(numShares);
        });

        it("Should fail if not admin starts protocol", async function () {
            const { vault, trader } = await loadFixture(deployVaultFixture);
            await expect(
                vault.connect(trader).startUpProtocol(ethers.ZeroAddress, ethers.ZeroAddress, ethers.ZeroAddress)
            ).to.be.revertedWithCustomError(vault, "NotAdmin");
        });

        it("Should prevent double initialization", async function () {
            const { vault, admin } = await loadFixture(deployVaultFixture);
            await expect(
                vault.connect(admin).startUpProtocol(ethers.ZeroAddress, ethers.ZeroAddress, ethers.ZeroAddress)
            ).to.be.revertedWithCustomError(vault, "AlreadyStarted");
        });

        it("Should revert with NotStarted if protocol not started", async function () {
            const [admin, trader] = await ethers.getSigners();
            const MockUSDC = await ethers.getContractFactory("MockUSDC");
            const mockUSDC = await MockUSDC.deploy();
            await mockUSDC.waitForDeployment();

            const MockChainlinkManager = await ethers.getContractFactory("MockChainlinkManager");
            const mockChainlinkManager = await MockChainlinkManager.deploy();
            await mockChainlinkManager.waitForDeployment();
            await mockChainlinkManager.setMarketOpen(true); // Set market open to test NotStarted error
            await mockChainlinkManager.setPrice(Utils.Asset.TSLA, 100 * 1e8); // Set price to avoid "Price not set" error
            await mockChainlinkManager.setDexPrice(Utils.Asset.TSLA, 99 * 1e8); // Set TWAP price

            const Vault = await ethers.getContractFactory("Vault");
            const vault = await Vault.deploy(
                await mockUSDC.getAddress(),
                admin.address,
                await mockChainlinkManager.getAddress()
            );
            await vault.waitForDeployment();

            const numShares = ethers.parseUnits("10", 18);

            await expect(
                vault.connect(trader).openPosition(Utils.Asset.TSLA, numShares)
            ).to.be.revertedWithCustomError(vault, "NotStarted");
        });
    });

    describe("Fee Calculations", function () {
        it("Should apply base fee when deviation < 3%", async function () {
            const { vault } = await loadFixture(deployVaultFixture);
            const fee = await vault._calculateMintFee(
                ethers.parseUnits("102", 18),
                ethers.parseUnits("100", 18)
            );
            expect(fee).to.equal(ethers.parseUnits("0.005", 18));
        });

        it("Should apply increased fee for undervalued assets", async function () {
            const { vault } = await loadFixture(deployVaultFixture);
            const fee = await vault._calculateMintFee(
                ethers.parseUnits("94", 18),
                ethers.parseUnits("100", 18)
            );
            expect(fee).to.be.gt(ethers.parseUnits("0.005", 18));
        });

        it("Should apply reduced fee for overvalued assets", async function () {
            const { vault } = await loadFixture(deployVaultFixture);
            const fee = await vault._calculateMintFee(
                ethers.parseUnits("108", 18),
                ethers.parseUnits("100", 18)
            );
            expect(fee).to.be.lt(ethers.parseUnits("0.005", 18));
        });
    });

    describe("Redemption", function () {
        describe("Successful Redemption", function () {
            it("Should redeem stock correctly and verify amounts", async function () {
                const { vault, vaultAddress, mockUSDC, mockSTSLA, trader, mockChainlinkManager } = await loadFixture(deployVaultFixture);

                const numShares = ethers.parseUnits("10", 18);
                const assetType = Utils.Asset.TSLA;
                const chainlinkPrice = 100n * BigInt(1e8); // $100 in 8 decimals

                // Set prices and calculate required USDC
                await mockChainlinkManager.setPrice(assetType, chainlinkPrice);
                await mockChainlinkManager.setDexPrice(assetType, chainlinkPrice); // Set TWAP price
                const requiredUSDC = await calculateRequiredUSDC(chainlinkPrice, numShares);

                // Mint and approve enough USDC for opening the position AND redeeming it
                await mockUSDC.connect(trader).mint(trader.address, requiredUSDC * 4n); // Increased mint amount
                await mockUSDC.connect(trader).approve(vaultAddress, requiredUSDC * 4n); // Increased approve amount

                // Open position
                await vault.connect(trader).openPosition(assetType, numShares);

                // Transfer USDC to the vault contract
                await mockUSDC.connect(trader).transfer(vaultAddress, requiredUSDC * 2n); // Ensure Vault has enough USDC

                // Redeem half the position
                const redeemAmount = numShares / 2n;
                await mockSTSLA.connect(trader).approve(vaultAddress, redeemAmount);

                const twapPrice = 99n * BigInt(1e8);
                await mockChainlinkManager.setDexPrice(assetType, twapPrice);

                // Calculate expected amounts
                const amountForSharesInUSD = (chainlinkPrice * redeemAmount) / ethers.parseUnits("1", 18);
                const redemptionFeePercentage = 5n; // 0.5%
                const redemptionFee = (amountForSharesInUSD * redemptionFeePercentage) / 1000n;
                const expectedUSDCAmount = amountForSharesInUSD - redemptionFee;

                await vault.connect(trader).redeemStock(assetType, redeemAmount)

                expect(await mockSTSLA.balanceOf(trader.address)).to.equal(numShares - redeemAmount);
            });
        });

        describe("Failure Scenarios", function () {
            // it("Should revert for insufficient contract USDC balance", async function () {
            //     const { vault, vaultAddress, mockUSDC, mockSTSLA, trader, mockChainlinkManager, admin } = await loadFixture(deployVaultFixture);

            //     const numShares = ethers.parseUnits("10", 18);
            //     const assetType = Utils.Asset.TSLA;

            //     // Open position
            //     await openPosition(vault, mockUSDC, trader, mockChainlinkManager, assetType, numShares);

            //     // Drain most, but not all, of the Vault's USDC
            //     const vaultBalance = await mockUSDC.balanceOf(vaultAddress);
            //     await mockUSDC.connect(admin).transfer(trader.address, vaultBalance - 1n); // Use admin to simulate transfer

            //     // Try to redeem shares
            //     const redeemAmount = ethers.parseUnits("5", 18); // Attempt to redeem half the shares
            //     await mockSTSLA.connect(trader).approve(vaultAddress, redeemAmount);

            //     await expect(
            //         vault.connect(trader).redeemStock(assetType, redeemAmount)
            //     ).to.be.revertedWithCustomError(vault, "InsufficientFundForPayout");
            // });

            it("Should revert if USDC transfer fails", async function () {
                const { vault, vaultAddress, mockUSDC, mockSTSLA, trader, mockChainlinkManager } = await loadFixture(deployVaultFixture);

                const numShares = ethers.parseUnits("10", 18);
                const assetType = Utils.Asset.TSLA;

                // Open position
                await openPosition(vault, mockUSDC, trader, mockChainlinkManager, assetType, numShares);

                // Make USDC transfer fail
                await mockUSDC.setTransferShouldFail(true);

                await expect(vault.connect(trader).redeemStock(assetType, numShares))
                    .to.be.revertedWithCustomError(vault, "TransferofFundsFailed");
            });

            it("Should revert for zero share redemption", async function () {
                const { vault, trader } = await loadFixture(deployVaultFixture);
                await expect(vault.connect(trader).redeemStock(Utils.Asset.TSLA, 0))
                    .to.be.revertedWithCustomError(vault, "InsufficientTokenAmountSpecified");
            });
        });
    });

    describe("Burn Authorization", function () {
        it("Should prevent non-vault from burning tokens", async function () {
            const { vault, mockSTSLA, trader } = await loadFixture(deployVaultFixture);
            await expect(mockSTSLA.connect(trader).burn(trader.address, 1000))
                .to.be.revertedWith("Only burner can burn");
        });

        // it("Should allow vault to burn tokens", async function () {
        //     const { vault, mockSTSLA, trader } = await loadFixture(deployVaultFixture);
        //     await mockSTSLA.connect(await vault.getAddress()).mint(trader.address, 1000);
        //     await expect(mockSTSLA.connect(vault).burn(trader.address, 1000))
        //         .to.not.be.reverted;
        // });
    });

    describe("Vault Redemption", function () {
        it("Should fail to redeem with invalid vault ID", async function () {
            const { vault, trader } = await loadFixture(deployVaultFixture);

            await expect(
                vault.connect(trader).redeemVault(999, ethers.parseUnits("1", 18))
            ).to.be.revertedWithCustomError(vault, "InvalidVaultID");
        });

        it("Should fail to redeem from already paid out vault", async function () {
            const { vault, trader, mockUSDC, mockChainlinkManager } = await loadFixture(deployVaultFixture);
            const numShares = ethers.parseUnits("1", 18);

            // Open position
            await openPosition(vault, mockUSDC, trader, mockChainlinkManager, Utils.Asset.TSLA, numShares);

            // Get vault ID (first position is index 0)
            const vaultID = 0;

            // Redeem once
            await vault.connect(trader).redeemVault(vaultID, numShares);

            // Try to redeem again
            await expect(
                vault.connect(trader).redeemVault(vaultID, numShares)
            ).to.be.revertedWithCustomError(vault, "VaultAlreadyPaidOut");
        });

        it("Should fail to redeem more shares than owned", async function () {
            const { vault, trader, mockUSDC, mockChainlinkManager } = await loadFixture(deployVaultFixture);
            const numShares = ethers.parseUnits("1", 18);

            // Open position
            await openPosition(vault, mockUSDC, trader, mockChainlinkManager, 0, numShares);

            // Try to redeem more than owned
            await expect(
                vault.connect(trader).redeemStock(0, numShares * 2n)
            ).to.be.revertedWithCustomError(vault, "StocksToReddemLowerThanUserBalance");
        });
    });


});

