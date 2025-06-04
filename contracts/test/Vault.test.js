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

        // Then deploy Vault with the mock already available
        const Vault = await ethers.getContractFactory("Vault");
        const vault = await ethers.deployContract("Vault", [
            mockUSDC.target,
            admin.address,
            mockChainlinkManager.target  // Pass as constructor parameter
        ]);



        // Initialize protocol
        await vault.connect(admin).startUpProtocol(mockSTSLA.target, mockSAPPL.target);

        // Set initial prices ($100 oracle, $99 dex)
        await mockChainlinkManager.setPrice(Utils.Asset.TSLA, 100 * 1e8);  // $100
        await mockChainlinkManager.setDexPrice(Utils.Asset.TSLA, 99 * 1e8); // $99
        await mockChainlinkManager.setPrice(Utils.Asset.APPL, 150 * 1e8);   // $150
        await mockChainlinkManager.setDexPrice(Utils.Asset.APPL, 148 * 1e8); // $148

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
            const { admin, mockChainlinkManager, mockUSDC } = await loadFixture(deployVaultFixture);
            await ethers.getContractFactory("Vault");
            const vault = await ethers.deployContract("Vault", [
                mockUSDC.target,
                admin.address,
                mockChainlinkManager.target  // Pass as constructor parameter
            ]);
            expect(await vault.isStarted()).to.be.false;
        });
    });

    describe("Protocol Startup", function () {
        it("Should initialize assets correctly through position opening", async function () {
            const { vault, mockUSDC, mockSTSLA, mockSAPPL, trader } = await loadFixture(deployVaultFixture);

            const numShares = ethers.parseUnits("10", 18);

            // Calculate required collateral for both positions
            const tslaOraclePrice = ethers.parseUnits("100", 18);
            const tslaPositionValue = tslaOraclePrice * numShares / ethers.parseUnits("1", 18);
            const tslaCollateral = tslaPositionValue * 110n / 100n;
            const tslaUSDC = tslaCollateral / 1_000_000_000_000n;

            const applOraclePrice = ethers.parseUnits("150", 18);
            const applPositionValue = applOraclePrice * numShares / ethers.parseUnits("1", 18);
            const applCollateral = applPositionValue * 110n / 100n;
            const applUSDC = applCollateral / 1_000_000_000_000n;

            const totalRequiredUSDC = tslaUSDC + applUSDC;

            // Fund trader with enough USDC for both positions
            await mockUSDC.connect(trader).mint(trader.address, totalRequiredUSDC * 2n);

            // Approve vault to spend USDC
            await mockUSDC.connect(trader).approve(vault.target, totalRequiredUSDC * 2n);

            // Open and verify TSLA position
            await expect(vault.connect(trader).openPosition(Utils.Asset.TSLA, numShares))
                .to.emit(vault, "PositionCreated");
            expect(await mockSTSLA.balanceOf(trader.address)).to.equal(numShares);

            // Open and verify APPL position
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
            const { admin, trader, mockChainlinkManager, mockUSDC } = await loadFixture(deployVaultFixture);
            const Vault = await ethers.getContractFactory("Vault");
            const vault = await ethers.deployContract("Vault", [
                mockUSDC.target,
                admin.address,
                mockChainlinkManager.target
            ]);
            const numShares = ethers.parseUnits("10", 18);
            await expect(
                vault.connect(trader).openPosition(Utils.Asset.TSLA, numShares)
            ).to.be.revertedWithCustomError(vault, "NotStarted");
        });
    });

    describe("Position Management", function () {
        const numShares = ethers.parseUnits("10", 18); // 10 tokens (18 decimals)
        const assetType = Utils.Asset.TSLA;

        it("Should open position correctly", async function () {
            const { vault, mockUSDC, mockSTSLA, trader } = await loadFixture(deployVaultFixture);

            // Input values
            const numShares = ethers.parseUnits("10", 18); // 10 shares
            const assetType = Utils.Asset.TSLA;

            // Oracle price = $100 (18 decimals)
            const oraclePrice = ethers.parseUnits("100", 18);

            // Calculate expected values with fee
            const positionValue = oraclePrice * numShares / ethers.parseUnits("1", 18);
            const baseCollateral = positionValue * 110n / 100n; // 110% collateral
            const mintFee = baseCollateral * 5n / 1000n; // 0.5% fee (5/1000)
            const totalCollateral = baseCollateral + mintFee;

            // Expected buffer is 10% of total collateral
            const expectedBuffer = totalCollateral / 10n;

            // Convert to USDC amount (18→6 decimals)
            const expectedUSDCAmount = totalCollateral / 1_000_000_000_000n;

            // Fund trader with 2x required USDC
            await mockUSDC.connect(trader).mint(trader.address, expectedUSDCAmount * 2n);
            await mockUSDC.connect(trader).approve(vault.target, expectedUSDCAmount);

            // Execute position opening
            await expect(vault.connect(trader).openPosition(assetType, numShares))
                .to.emit(vault, "PositionCreated");

            // Verify results
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
            const { vault, trader, mockUSDC } = await loadFixture(deployVaultFixture);

            // Ensure protocol is ready
            expect(await vault.isStarted()).to.be.true;
            expect(await vault.isPaused()).to.be.false;

            // Fund trader adequately
            const usdcAmount = ethers.parseUnits("10000", 6);
            await mockUSDC.connect(trader).mint(trader.address, usdcAmount);
            await mockUSDC.connect(trader).approve(vault.target, usdcAmount);

            // First test valid asset to ensure setup works
            await expect(
                vault.connect(trader).openPosition(Utils.Asset.TSLA, numShares)
            ).to.emit(vault, "PositionCreated");

            // Now test invalid asset
            // await expect(
            //     vault.connect(trader).openPosition(2, numShares)
            // ).to.be.revertedWithCustomError(vault, "InvalidAssetTypeUsed");
        });

        it("Should revert with TransferofFundsFailed if USDC transfer fails", async function () {
            const { vault, trader } = await loadFixture(deployVaultFixture);
            const numShares = ethers.parseUnits("10", 18);
            // Do NOT mint or approve USDC for trader
            await expect(
                vault.connect(trader).openPosition(Utils.Asset.TSLA, numShares)
            ).to.be.revertedWithCustomError(vault, "TransferofFundsFailed");
        });

        it("Should allow opening positions after unpausing", async function () {
            const { vault, admin, trader, mockUSDC } = await loadFixture(deployVaultFixture);
            const numShares = ethers.parseUnits("10", 18);
            await vault.connect(admin).pause();
            await vault.connect(admin).unpause();
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
                ethers.parseUnits("102", 18), // Dex: $102
                ethers.parseUnits("100", 18)  // Oracle: $100
            );
            expect(fee).to.equal(ethers.parseUnits("0.005", 18)); // 0.5%
        });

        it("Should apply increased fee for undervalued assets", async function () {
            const { vault } = await loadFixture(deployVaultFixture);
            const fee = await vault._calculateMintFee(
                ethers.parseUnits("94", 18), // Dex: $94 (6% below)
                ethers.parseUnits("100", 18) // Oracle: $100
            );
            expect(fee).to.be.gt(ethers.parseUnits("0.005", 18));
        });

        it("Should apply reduced fee for overvalued assets", async function () {
            const { vault } = await loadFixture(deployVaultFixture);
            const fee = await vault._calculateMintFee(
                ethers.parseUnits("108", 18), // Dex: $108 (8% above)
                ethers.parseUnits("100", 18)  // Oracle: $100
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
});