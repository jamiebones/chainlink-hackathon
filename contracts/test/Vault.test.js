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

        // NEW: Set fee receiver so redemption fee can be transferred
        await vault.connect(admin).setFeeReceiver(admin.address);

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
        await mockChainlinkManager.setPrice(Utils.Asset.TSLA, ethers.parseUnits("100", 18)); // $100 in 8 decimals
        await mockChainlinkManager.setDexPrice(Utils.Asset.TSLA, ethers.parseUnits("99", 18)); // $99 in 8 decimals
        await mockChainlinkManager.setPrice(Utils.Asset.APPL, ethers.parseUnits("150", 18)); // $150 in 8 decimals
        await mockChainlinkManager.setDexPrice(Utils.Asset.APPL, ethers.parseUnits("148.5", 18)); // $148.5 in 8 decimals

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


        // Calculate amounts in USD (18 decimals)
        const amountForSharesInUSD = (chainlinkPrice * numShares) / PRECISION;
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
            const chainlinkPrice = 100n * BigInt(1e18); // $100 in 8 decimals
            const twapPrice = 99n * BigInt(1e18); // $99 in 8 decimals

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
            const chainlinkPrice = 100n * BigInt(1e18); // $100 in 8 decimals
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

        // it("Should fail to open position when market is closed", async function () {
        //     const { vault, trader, mockUSDC, mockChainlinkManager, vaultAddress } = await loadFixture(deployVaultFixture);
        //     const numShares = ethers.parseUnits("0.001", 18);

        //     await mockChainlinkManager.setMarketOpen(false);

        //     await mockUSDC.connect(trader).mint(trader.address, ethers.parseUnits("1000000", 18)); // Very small amount
        //     await mockUSDC.connect(trader).approve(vaultAddress, ethers.parseUnits("1000000", 18)); // Very small amount

        //     await expect(
        //         vault.connect(trader).openPosition(0, numShares)
        //     ).to.be.revertedWithCustomError(vault, "MarketNotOpen");
        // });

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
            await mockChainlinkManager.setPrice(Utils.Asset.TSLA, ethers.parseUnits("100", 18)); // Set price to avoid "Price not set" error
            await mockChainlinkManager.setDexPrice(Utils.Asset.TSLA, ethers.parseUnits("99", 18)); // Set TWAP price

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
                const chainlinkPrice = 100n * BigInt(1e18); // $100 in 8 decimals

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
            const { vault, trader, mockUSDC, mockChainlinkManager, vaultAddress } = await loadFixture(deployVaultFixture);
            const numShares = ethers.parseUnits("1", 18);

            // Open position
            await openPosition(vault, mockUSDC, trader, mockChainlinkManager, Utils.Asset.TSLA, numShares);

            const balance = await mockUSDC.balanceOf(vaultAddress);

            console.log("Vault USDC balance before redeem:", balance.toString());

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

    describe("Fee Receiver", function () {
        it("Should transfer fee to receiver when a position is redeemed", async function () {
            const { vault, vaultAddress, mockUSDC, mockSTSLA, trader, mockChainlinkManager, admin } = await loadFixture(deployVaultFixture);
            const assetType = Utils.Asset.TSLA;
            const numShares = ethers.parseUnits("10", 18);

            // Open a position (assumed helper function)
            await openPosition(vault, mockUSDC, trader, mockChainlinkManager, assetType, numShares);

            // Fund the Vault with extra USDC so that redemption can pay out:
            // (Assuming USDC has 6 decimals)
            const extraUSDC = ethers.parseUnits("1000", 6);
            await mockUSDC.connect(trader).transfer(vaultAddress, extraUSDC);

            // Capture fee receiver balance BEFORE redemption:
            const feeReceiverBefore = await mockUSDC.balanceOf(admin.address);

            // Set TWAP price to introduce a fee deviation (ensure non-zero fee)
            // For example, if chainlink price is 100*1e8, set dex price to 99*1e8.
            await mockChainlinkManager.setDexPrice(assetType, 99n * BigInt(1e8));

            // Trader approves redemption of half the shares:
            const redeemAmount = ethers.parseUnits("5", 18);
            await mockSTSLA.connect(trader).approve(vaultAddress, redeemAmount);

            // Redeem stock (this should trigger a fee transfer to fee receiver)
            const tx = await vault.connect(trader).redeemStock(assetType, redeemAmount);
            await tx.wait();

            // Capture fee receiver balance AFTER redemption:
            const feeReceiverAfter = await mockUSDC.balanceOf(admin.address);

            expect(feeReceiverAfter).to.be.gt(feeReceiverBefore);
        });
    });

    describe("Vault Redemption - redeemVault", function () {
        it("Should allow partial redemption and update vault state", async function () {
            const { vault, mockUSDC, mockSTSLA, trader, mockChainlinkManager } = await loadFixture(deployVaultFixture);
            const numShares = ethers.parseUnits("10", 18);

            // Open position
            await openPosition(vault, mockUSDC, trader, mockChainlinkManager, Utils.Asset.TSLA, numShares);

            // Partial redemption (half)
            const redeemAmount = ethers.parseUnits("5", 18);
            await mockSTSLA.connect(trader).approve(await vault.getAddress(), redeemAmount);

            // Should succeed
            await vault.connect(trader).redeemVault(0, redeemAmount);

            // Vault state should be updated (not paid out, still active)
            const vaultSlot = await vault.userPositions(trader.address, 0);
            expect(vaultSlot.paidOut).to.be.false;
            expect(vaultSlot.isActive).to.be.true;
            expect(vaultSlot.mintedAmount).to.equal(redeemAmount); // 10 - 5 = 5 left

            await vault.connect(trader).redeemVault(0, redeemAmount);
            const vaultSlot2 = await vault.userPositions(trader.address, 0);
            console.log("vault slot" , vaultSlot2.mintedAmount)
            expect(vaultSlot2.paidOut).to.be.true;
            expect(vaultSlot2.isActive).to.be.false;
        });

        it("Should allow full redemption and mark vault as paid out", async function () {
            const { vault, mockUSDC, mockSTSLA, trader, mockChainlinkManager } = await loadFixture(deployVaultFixture);
            const numShares = ethers.parseUnits("10", 18);

            // Open position
            await openPosition(vault, mockUSDC, trader, mockChainlinkManager, Utils.Asset.TSLA, numShares);

            // Full redemption
            await mockSTSLA.connect(trader).approve(await vault.getAddress(), numShares);

            await expect(
                vault.connect(trader).redeemVault(0, numShares)
            ).to.emit(vault, "VaultClosed");

            // Vault state should be updated (paid out, not active)
            const vaultSlot = await vault.userPositions(trader.address, 0);
            expect(vaultSlot.paidOut).to.be.true;
            expect(vaultSlot.isActive).to.be.false;
            expect(vaultSlot.mintedAmount).to.equal(0);
        });

        it("Should fail to redeem with invalid vault ID", async function () {
            const { vault, trader } = await loadFixture(deployVaultFixture);
            await expect(
                vault.connect(trader).redeemVault(999, ethers.parseUnits("1", 18))
            ).to.be.revertedWithCustomError(vault, "InvalidVaultID");
        });

        it("Should fail to redeem from already paid out vault", async function () {
            const { vault, mockUSDC, mockSTSLA, trader, mockChainlinkManager } = await loadFixture(deployVaultFixture);
            const numShares = ethers.parseUnits("10", 18);

            // Open position
            await openPosition(vault, mockUSDC, trader, mockChainlinkManager, Utils.Asset.TSLA, numShares);

            // Full redemption
            await mockSTSLA.connect(trader).approve(await vault.getAddress(), numShares);
            await vault.connect(trader).redeemVault(0, numShares);

            // Try to redeem again
            await expect(
                vault.connect(trader).redeemVault(0, numShares)
            ).to.be.revertedWithCustomError(vault, "VaultAlreadyPaidOut");
        });

        it("Should fail to redeem zero shares", async function () {
            const { vault, mockUSDC, mockSTSLA, trader, mockChainlinkManager } = await loadFixture(deployVaultFixture);
            const numShares = ethers.parseUnits("10", 18);

            // Open position
            await openPosition(vault, mockUSDC, trader, mockChainlinkManager, Utils.Asset.TSLA, numShares);

            await expect(
                vault.connect(trader).redeemVault(0, 0)
            ).to.be.revertedWithCustomError(vault, "InsufficientTokenAmountSpecified");
        });

        it("Should fail to redeem more shares than minted", async function () {
            const { vault, mockUSDC, mockSTSLA, trader, mockChainlinkManager } = await loadFixture(deployVaultFixture);
            const numShares = ethers.parseUnits("10", 18);

            // Open position
            await openPosition(vault, mockUSDC, trader, mockChainlinkManager, Utils.Asset.TSLA, numShares);

            await expect(
                vault.connect(trader).redeemVault(0, ethers.parseUnits("20", 18))
            ).to.be.revertedWith("Redeem amount exceeds minted amount");
        });

        // it("Should fail if fee receiver is not set", async function () {
        //     const { vault, mockUSDC, mockSTSLA, trader, mockChainlinkManager, admin } = await loadFixture(deployVaultFixture);
        //     const numShares = ethers.parseUnits("10", 18);

        //     // Remove fee receiver
        //     await vault.connect(admin).setFeeReceiver(ethers.ZeroAddress);

        //     // Open position
        //     await openPosition(vault, mockUSDC, trader, mockChainlinkManager, Utils.Asset.TSLA, numShares);

        //     await expect(
        //         vault.connect(trader).redeemVault(0, ethers.parseUnits("5", 18))
        //     ).to.be.revertedWithCustomError(vault, "FeeReceiverNotSet");
        // });
    });


});

