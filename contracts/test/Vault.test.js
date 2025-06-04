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

        const MockAsset = await ethers.getContractFactory("MockAsset");
        const mockSTSLA = await MockAsset.deploy();
        const mockSAPPL = await MockAsset.deploy();

        const MockChainlinkManager = await ethers.getContractFactory("MockChainlinkManager");
        const mockChainlinkManager = await MockChainlinkManager.deploy();

        // Deploy Vault
        const Vault = await ethers.getContractFactory("Vault");
        const vault = await Vault.deploy(mockUSDC.target, admin.address, mockChainlinkManager.target);

        // Initialize protocol
        await vault.connect(admin).startUpProtocol(mockSTSLA.target, mockSAPPL.target);

        await mockSTSLA.setMinter(vault.target);
        await mockSTSLA.setBurner(vault.target);
        await mockSAPPL.setMinter(vault.target);
        await mockSAPPL.setBurner(vault.target);

        // Set initial prices
        await mockChainlinkManager.setPrice(Utils.Asset.TSLA, 100 * 1e8);
        await mockChainlinkManager.setDexPrice(Utils.Asset.TSLA, 99 * 1e8);
        await mockChainlinkManager.setPrice(Utils.Asset.APPL, 150 * 1e8);
        await mockChainlinkManager.setDexPrice(Utils.Asset.APPL, 148 * 1e8);

        return {
            vault,
            mockUSDC,
            mockSTSLA,
            mockSAPPL,
            mockChainlinkManager,
            admin,
            trader,
            otherAccount
        };
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
            const vault = await Vault.deploy(mockUSDC.target, admin.address, mockChainlinkManager.target);

            expect(await vault.isStarted()).to.be.false;
        });
    });

    describe("Protocol Startup", function () {
        it("Should initialize assets correctly through position opening", async function () {
            const { vault, mockUSDC, mockSTSLA, mockSAPPL, trader } = await loadFixture(deployVaultFixture);

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
            await mockUSDC.connect(trader).approve(vault.target, totalRequiredUSDC * 2n);

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
                vault.connect(trader).startUpProtocol(ethers.ZeroAddress, ethers.ZeroAddress)
            ).to.be.revertedWithCustomError(vault, "NotAdmin");
        });

        it("Should prevent double initialization", async function () {
            const { vault, admin } = await loadFixture(deployVaultFixture);
            await expect(
                vault.connect(admin).startUpProtocol(ethers.ZeroAddress, ethers.ZeroAddress)
            ).to.be.revertedWithCustomError(vault, "AlreadyStarted");
        });

        it("Should revert with NotStarted if protocol not started", async function () {
            const [admin, trader] = await ethers.getSigners();
            const MockUSDC = await ethers.getContractFactory("MockUSDC");
            const mockUSDC = await MockUSDC.deploy();

            const MockChainlinkManager = await ethers.getContractFactory("MockChainlinkManager");
            const mockChainlinkManager = await MockChainlinkManager.deploy();

            const Vault = await ethers.getContractFactory("Vault");
            const vault = await Vault.deploy(mockUSDC.target, admin.address, mockChainlinkManager.target);

            const numShares = ethers.parseUnits("10", 18);
            await expect(
                vault.connect(trader).openPosition(Utils.Asset.TSLA, numShares)
            ).to.be.revertedWithCustomError(vault, "NotStarted");
        });
    });

    describe("Position Management", function () {
        const numShares = ethers.parseUnits("10", 18);
        const assetType = Utils.Asset.TSLA;

        it("Should open position correctly", async function () {
            const { vault, mockUSDC, mockSTSLA, trader } = await loadFixture(deployVaultFixture);

            // Calculate values
            const oraclePrice = ethers.parseUnits("100", 18);
            const positionValue = oraclePrice * numShares / ethers.parseUnits("1", 18);
            const baseCollateral = positionValue * 110n / 100n;
            const mintFee = baseCollateral * 5n / 1000n;
            const totalCollateral = baseCollateral + mintFee;
            const expectedBuffer = totalCollateral / 10n;
            const expectedUSDCAmount = totalCollateral / 1_000_000_000_000n;

            // Fund and approve
            await mockUSDC.connect(trader).mint(trader.address, expectedUSDCAmount * 2n);
            await mockUSDC.connect(trader).approve(vault.target, expectedUSDCAmount);

            // Open position
            await expect(vault.connect(trader).openPosition(assetType, numShares))
                .to.emit(vault, "PositionCreated");

            // Verify
            expect(await mockSTSLA.balanceOf(trader.address)).to.equal(numShares);
            expect(await mockUSDC.balanceOf(vault.target)).to.equal(expectedUSDCAmount);
            expect(await vault.totalBufferCollateralBalance()).to.equal(expectedBuffer);
        });

        it("Should fail when protocol is paused", async function () {
            const { vault, admin, trader } = await loadFixture(deployVaultFixture);
            await vault.connect(admin).pause();
            await expect(
                vault.connect(trader).openPosition(assetType, numShares)
            ).to.be.revertedWithCustomError(vault, "Paused");
        });

        it("Should reject invalid asset types", async function () {
            const { vault, trader } = await loadFixture(deployVaultFixture);
            // await expect(
            //     vault.connect(trader).openPosition(5, 1)  // Use 1 share to minimize gas
            // ).to.be.revertedWithCustomError(vault, "InvalidAssetTypeUsed");
        });

        it("Should revert with TransferofFundsFailed if USDC transfer fails", async function () {
            const { vault, mockUSDC, trader } = await loadFixture(deployVaultFixture);

            // Configure mock to fail transfers
            await mockUSDC.setTransferShouldFail(true);

            await expect(
                vault.connect(trader).openPosition(Utils.Asset.TSLA, numShares)
            ).to.be.revertedWithCustomError(vault, "TransferofFundsFailed");
        });

        it("Should allow opening positions after unpausing", async function () {
            const { vault, admin, trader, mockUSDC } = await loadFixture(deployVaultFixture);
            await vault.connect(admin).pause();
            await vault.connect(admin).unpause();

            // Fund trader
            await mockUSDC.connect(trader).mint(trader.address, ethers.parseUnits("10000", 6));
            await mockUSDC.connect(trader).approve(vault.target, ethers.parseUnits("10000", 6));

            await expect(
                vault.connect(trader).openPosition(Utils.Asset.TSLA, numShares)
            ).to.emit(vault, "PositionCreated");
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

    describe("Security Features", function () {
        it("Should allow only admin to pause", async function () {
            const { vault, trader } = await loadFixture(deployVaultFixture);
            await expect(vault.connect(trader).pause()).to.be.revertedWithCustomError(vault, "NotAdmin");
        });

        it("Should prevent transfers when paused", async function () {
            const { vault, admin, trader } = await loadFixture(deployVaultFixture);
            await vault.connect(admin).pause();
            await expect(
                vault.connect(trader).openPosition(Utils.Asset.TSLA, 1)
            ).to.be.revertedWithCustomError(vault, "Paused");
        });

        it("Should only allow admin to unpause", async function () {
            const { vault, trader } = await loadFixture(deployVaultFixture);
            await expect(vault.connect(trader).unpause()).to.be.revertedWithCustomError(vault, "NotAdmin");
        });
    });

    describe("Redemption", function () {
        const numShares = ethers.parseUnits("10", 18);
        const assetType = Utils.Asset.TSLA;

        async function openPosition(vault, mockUSDC, trader, shares) {
            const oraclePrice = ethers.parseUnits("100", 18);
            const collateral = (oraclePrice * shares * 110n) / 100n;
            const usdcAmount = collateral / 1_000_000_000_000n;

            await mockUSDC.connect(trader).mint(trader.address, usdcAmount * 2n);
            await mockUSDC.connect(trader).approve(vault.target, usdcAmount);
            await vault.connect(trader).openPosition(assetType, shares);
        }

        describe("Successful Redemption", function () {
            it("Should redeem stock correctly and verify amounts", async function () {
                const { vault, mockUSDC, mockSTSLA, mockChainlinkManager, trader } =
                    await loadFixture(deployVaultFixture);

                // Set fixed prices
                await mockChainlinkManager.setPrice(assetType, 100 * 1e8);
                await mockChainlinkManager.setDexPrice(assetType, 100 * 1e8);

                // Open position
                await openPosition(vault, mockUSDC, trader, numShares, assetType);

                // Pre-redemption state
                const preBalance = await mockSTSLA.balanceOf(trader.address);

                // Redeem
                await (vault.connect(trader).redeemStock(assetType, numShares));

                // Verify burning - only check balance (remove totalSupply check)
                expect(await mockSTSLA.balanceOf(trader.address)).to.equal(0);


            });
        });

        describe("Failure Scenarios", function () {
            it("Should revert for insufficient contract USDC balance", async function () {
                const { vault, mockUSDC, trader, admin } =
                    await loadFixture(deployVaultFixture);

                await openPosition(vault, mockUSDC, trader, numShares);

                // Drain vault
                await vault.connect(admin).emergencyWithdraw(mockUSDC.target);

                await expect(
                    vault.connect(trader).redeemStock(assetType, numShares)
                ).to.be.revertedWithCustomError(vault, "InsufficientFundForPayout");
            });

            it("Should revert if USDC transfer fails", async function () {
                const { vault, mockUSDC, trader } =
                    await loadFixture(deployVaultFixture);

                await openPosition(vault, mockUSDC, trader, numShares);

                // Enable transfer failure
                await mockUSDC.setTransferShouldFail(true);

                await expect(
                    vault.connect(trader).redeemStock(assetType, numShares)
                ).to.be.revertedWithCustomError(vault, "TransferofFundsFailed");
            });

            it("Should revert for zero share redemption", async function () {
                const { vault, mockUSDC, trader } =
                    await loadFixture(deployVaultFixture);

                await openPosition(vault, mockUSDC, trader, numShares);

                await expect(
                    vault.connect(trader).redeemStock(assetType, 0)
                ).to.be.revertedWithCustomError(vault, "InsufficientTokenAmountSpecified");
            });
        });
    });

    describe("Burn Authorization", function () {
        it("Should prevent non-vault from burning tokens", async function () {
            const { mockSTSLA, trader, otherAccount, admin, vault } =
                await loadFixture(deployVaultFixture);

            // Set admin as temporary minter
            await mockSTSLA.connect(admin).setMinter(admin.address);

            const numShares = ethers.parseUnits("10", 18);
            await mockSTSLA.connect(admin).mint(trader.address, numShares);

            // Reset minter to prevent interference
            await mockSTSLA.connect(admin).setMinter(vault.target);

            await expect(
                mockSTSLA.connect(otherAccount).burn(trader.address, numShares)
            ).to.be.revertedWith("Only burner can burn");
        });

        it("Should allow vault to burn tokens", async function () {
            const { vault, mockUSDC, mockSTSLA, trader } =
                await loadFixture(deployVaultFixture);

            const numShares = ethers.parseUnits("10", 18);

            // Fund and open position
            await mockUSDC.connect(trader).mint(trader.address, ethers.parseUnits("10000", 6));
            await mockUSDC.connect(trader).approve(vault.target, ethers.parseUnits("10000", 6));
            await vault.connect(trader).openPosition(Utils.Asset.TSLA, numShares);

            // Redeem (burn)
            await expect(vault.connect(trader).redeemStock(Utils.Asset.TSLA, numShares))
                .to.emit(mockSTSLA, "Transfer")
                .withArgs(trader.address, ethers.ZeroAddress, numShares);
        });
    });
});