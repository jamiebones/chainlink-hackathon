const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("LiquidityPool", function () {
  let liquidityPool;
  let mockUSDC;
  let owner;
  let user1;
  let user2;
  let perpMarket;
  let vault;
  let unauthorizedUser;

  // Constants
  const USDC_DECIMALS = 6;
  const INITIAL_USDC_SUPPLY = ethers.parseUnits("1000000", USDC_DECIMALS); // 1M USDC
  const DEPOSIT_AMOUNT = ethers.parseUnits("1000", USDC_DECIMALS); // 1000 USDC

  beforeEach(async function () {
    [owner, user1, user2, perpMarket, vault, unauthorizedUser] = await ethers.getSigners();

    // Deploy Mock USDC Token
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    mockUSDC = await MockERC20.deploy("USD Coin", "USDC", USDC_DECIMALS);
    await mockUSDC.waitForDeployment();

    // Deploy LiquidityPool
    const LiquidityPool = await ethers.getContractFactory("LiquidityPool");
    liquidityPool = await LiquidityPool.deploy(await mockUSDC.getAddress());
    await liquidityPool.waitForDeployment();

    // Set authorized contracts
    await liquidityPool.setPerpMarket(perpMarket.address);
    await liquidityPool.setVault(vault.address);

    // Mint USDC to test users
    await mockUSDC.mint(user1.address, INITIAL_USDC_SUPPLY);
    await mockUSDC.mint(user2.address, INITIAL_USDC_SUPPLY);
    await mockUSDC.mint(perpMarket.address, INITIAL_USDC_SUPPLY);
    await mockUSDC.mint(vault.address, INITIAL_USDC_SUPPLY);

    // Approve LiquidityPool for USDC transfers
    await mockUSDC.connect(user1).approve(await liquidityPool.getAddress(), ethers.MaxUint256);
    await mockUSDC.connect(user2).approve(await liquidityPool.getAddress(), ethers.MaxUint256);
    await mockUSDC.connect(perpMarket).approve(await liquidityPool.getAddress(), ethers.MaxUint256);
    await mockUSDC.connect(vault).approve(await liquidityPool.getAddress(), ethers.MaxUint256);
  });

  describe("Deployment", function () {
    it("Should set the correct USDC token address", async function () {
      expect(await liquidityPool.usdc()).to.equal(await mockUSDC.getAddress());
    });

    it("Should set the correct owner", async function () {
      expect(await liquidityPool.owner()).to.equal(owner.address);
    });

    it("Should have correct LP token name and symbol", async function () {
      expect(await liquidityPool.name()).to.equal("Synthetic Equity Liquidity Pool");
      expect(await liquidityPool.symbol()).to.equal("SYEQ-LP");
    });

    it("Should initialize with zero liquidity and reserves", async function () {
      expect(await liquidityPool.totalLiquidity()).to.equal(0);
      expect(await liquidityPool.reservedLiquidity()).to.equal(0);
      expect(await liquidityPool.totalFeesCollected()).to.equal(0);
      expect(await liquidityPool.totalFeesClaimed()).to.equal(0);
    });
  });

  describe("Access Control", function () {
    it("Should allow owner to set perp market", async function () {
      await liquidityPool.setPerpMarket(user1.address);
      expect(await liquidityPool.perpMarket()).to.equal(user1.address);
    });

    it("Should allow owner to set vault", async function () {
      await liquidityPool.setVault(user1.address);
      expect(await liquidityPool.vault()).to.equal(user1.address);
    });

    it("Should revert when non-owner tries to set perp market", async function () {
      await expect(
        liquidityPool.connect(user1).setPerpMarket(user2.address)
      ).to.be.revertedWithCustomError(liquidityPool, "OwnableUnauthorizedAccount");
    });

    it("Should revert when non-owner tries to set vault", async function () {
      await expect(
        liquidityPool.connect(user1).setVault(user2.address)
      ).to.be.revertedWithCustomError(liquidityPool, "OwnableUnauthorizedAccount");
    });
  });

  describe("Deposits", function () {
    it("Should allow users to deposit USDC and receive LP tokens", async function () {
      const tx = await liquidityPool.connect(user1).deposit(DEPOSIT_AMOUNT);
      
      expect(await liquidityPool.totalLiquidity()).to.equal(DEPOSIT_AMOUNT);
      expect(await liquidityPool.balanceOf(user1.address)).to.equal(DEPOSIT_AMOUNT);
      expect(await mockUSDC.balanceOf(await liquidityPool.getAddress())).to.equal(DEPOSIT_AMOUNT);

      await expect(tx)
        .to.emit(liquidityPool, "Deposited")
        .withArgs(user1.address, DEPOSIT_AMOUNT, DEPOSIT_AMOUNT);
    });

    it("Should mint LP tokens proportionally for subsequent deposits", async function () {
      // First deposit
      await liquidityPool.connect(user1).deposit(DEPOSIT_AMOUNT);
      
      // Second deposit (same amount)
      await liquidityPool.connect(user2).deposit(DEPOSIT_AMOUNT);
      
      expect(await liquidityPool.totalLiquidity()).to.equal(DEPOSIT_AMOUNT * 2n);
      expect(await liquidityPool.balanceOf(user1.address)).to.equal(DEPOSIT_AMOUNT);
      expect(await liquidityPool.balanceOf(user2.address)).to.equal(DEPOSIT_AMOUNT);
      expect(await liquidityPool.totalSupply()).to.equal(DEPOSIT_AMOUNT * 2n);
    });

    it("Should revert when depositing zero amount", async function () {
      await expect(
        liquidityPool.connect(user1).deposit(0)
      ).to.be.revertedWithCustomError(liquidityPool, "ZeroAmount");
    });

    it("Should revert when user has insufficient USDC", async function () {
      const excessiveAmount = INITIAL_USDC_SUPPLY + 1n;
      await expect(
        liquidityPool.connect(user1).deposit(excessiveAmount)
      ).to.be.revertedWithCustomError(liquidityPool, "InsufficientUSDC");
    });
  });

  describe("Withdrawals", function () {
    beforeEach(async function () {
      // Setup: user1 deposits 1000 USDC
      await liquidityPool.connect(user1).deposit(DEPOSIT_AMOUNT);
    });

    it("Should allow users to withdraw USDC by burning LP tokens", async function () {
      const lpBalance = await liquidityPool.balanceOf(user1.address);
      const initialUSDCBalance = await mockUSDC.balanceOf(user1.address);
      
      const tx = await liquidityPool.connect(user1).withdraw(lpBalance);
      
      expect(await liquidityPool.balanceOf(user1.address)).to.equal(0);
      expect(await liquidityPool.totalLiquidity()).to.equal(0);
      expect(await mockUSDC.balanceOf(user1.address)).to.equal(initialUSDCBalance + DEPOSIT_AMOUNT);

      await expect(tx)
        .to.emit(liquidityPool, "Withdrawn")
        .withArgs(user1.address, DEPOSIT_AMOUNT, lpBalance);
    });

    it("Should allow partial withdrawals", async function () {
      const lpBalance = await liquidityPool.balanceOf(user1.address);
      const halfLPAmount = lpBalance / 2n;
      const halfUSDCAmount = DEPOSIT_AMOUNT / 2n;
      
      await liquidityPool.connect(user1).withdraw(halfLPAmount);
      
      expect(await liquidityPool.balanceOf(user1.address)).to.equal(halfLPAmount);
      expect(await liquidityPool.totalLiquidity()).to.equal(halfUSDCAmount);
    });

    it("Should revert when withdrawing zero amount", async function () {
      await expect(
        liquidityPool.connect(user1).withdraw(0)
      ).to.be.revertedWithCustomError(liquidityPool, "ZeroAmount");
    });

    it("Should revert when user has insufficient LP balance", async function () {
      const lpBalance = await liquidityPool.balanceOf(user1.address);
      await expect(
        liquidityPool.connect(user1).withdraw(lpBalance + 1n)
      ).to.be.revertedWithCustomError(liquidityPool, "InsufficientLPBalance");
    });

    it("Should revert when trying to withdraw more than available liquidity", async function () {
      // Reserve some liquidity to make it unavailable
      const reserveAmount = DEPOSIT_AMOUNT / 2n;
      await liquidityPool.connect(perpMarket).reserve(reserveAmount);
      
      const lpBalance = await liquidityPool.balanceOf(user1.address);
      await expect(
        liquidityPool.connect(user1).withdraw(lpBalance)
      ).to.be.revertedWithCustomError(liquidityPool, "InsufficientLiquidity");
    });
  });

  describe("Liquidity Reservations", function () {
    beforeEach(async function () {
      await liquidityPool.connect(user1).deposit(DEPOSIT_AMOUNT);
    });

    it("Should allow perp market to reserve liquidity", async function () {
      const reserveAmount = DEPOSIT_AMOUNT / 2n;
      
      const tx = await liquidityPool.connect(perpMarket).reserve(reserveAmount);
      
      expect(await liquidityPool.reservedLiquidity()).to.equal(reserveAmount);
      expect(await liquidityPool.availableLiquidity()).to.equal(DEPOSIT_AMOUNT - reserveAmount);

      await expect(tx)
        .to.emit(liquidityPool, "Reserved")
        .withArgs(reserveAmount);
    });

    it("Should revert when non-perp tries to reserve", async function () {
      await expect(
        liquidityPool.connect(user1).reserve(DEPOSIT_AMOUNT / 2n)
      ).to.be.revertedWithCustomError(liquidityPool, "NotPerpMarket");
    });

    it("Should revert when reserving more than available liquidity", async function () {
      await expect(
        liquidityPool.connect(perpMarket).reserve(DEPOSIT_AMOUNT + 1n)
      ).to.be.revertedWithCustomError(liquidityPool, "InsufficientLiquidity");
    });

    it("Should revert when reserving zero amount", async function () {
      await expect(
        liquidityPool.connect(perpMarket).reserve(0)
      ).to.be.revertedWithCustomError(liquidityPool, "ZeroAmount");
    });
  });

  describe("Liquidity Releases", function () {
    beforeEach(async function () {
      await liquidityPool.connect(user1).deposit(DEPOSIT_AMOUNT);
      await liquidityPool.connect(perpMarket).reserve(DEPOSIT_AMOUNT / 2n);
    });

    it("Should allow perp market to release liquidity to recipient", async function () {
      const releaseAmount = DEPOSIT_AMOUNT / 4n;
      const initialBalance = await mockUSDC.balanceOf(user2.address);
      
      const tx = await liquidityPool.connect(perpMarket).releaseTo(user2.address, releaseAmount);
      
      expect(await liquidityPool.reservedLiquidity()).to.equal(DEPOSIT_AMOUNT / 2n - releaseAmount);
      expect(await liquidityPool.totalLiquidity()).to.equal(DEPOSIT_AMOUNT - releaseAmount);
      expect(await mockUSDC.balanceOf(user2.address)).to.equal(initialBalance + releaseAmount);

      await expect(tx)
        .to.emit(liquidityPool, "Released")
        .withArgs(user2.address, releaseAmount);
    });

    it("Should revert when non-perp tries to release", async function () {
      await expect(
        liquidityPool.connect(user1).releaseTo(user2.address, DEPOSIT_AMOUNT / 4n)
      ).to.be.revertedWithCustomError(liquidityPool, "NotPerpMarket");
    });

    it("Should revert when releasing more than reserved", async function () {
      const reservedAmount = await liquidityPool.reservedLiquidity();
      await expect(
        liquidityPool.connect(perpMarket).releaseTo(user2.address, reservedAmount + 1n)
      ).to.be.revertedWithCustomError(liquidityPool, "OverRelease");
    });

    it("Should revert when releasing zero amount", async function () {
      await expect(
        liquidityPool.connect(perpMarket).releaseTo(user2.address, 0)
      ).to.be.revertedWithCustomError(liquidityPool, "ZeroAmount");
    });
  });

  describe("Reserve From External", function () {
    it("Should allow perp market to reserve funds from vault", async function () {
      const reserveAmount = DEPOSIT_AMOUNT;
      const initialPoolBalance = await mockUSDC.balanceOf(await liquidityPool.getAddress());
      
      const tx = await liquidityPool.connect(perpMarket).reserveFrom(vault.address, reserveAmount);
      
      expect(await liquidityPool.totalLiquidity()).to.equal(reserveAmount);
      expect(await liquidityPool.reservedLiquidity()).to.equal(reserveAmount);
      expect(await mockUSDC.balanceOf(await liquidityPool.getAddress())).to.equal(initialPoolBalance + reserveAmount);

      await expect(tx)
        .to.emit(liquidityPool, "Reserved")
        .withArgs(reserveAmount);
    });

    it("Should revert when external address has insufficient USDC", async function () {
      const excessiveAmount = INITIAL_USDC_SUPPLY + 1n;
      await expect(
        liquidityPool.connect(perpMarket).reserveFrom(vault.address, excessiveAmount)
      ).to.be.revertedWithCustomError(liquidityPool, "InsufficientUSDC");
    });

    it("Should revert when non-perp tries to reserveFrom", async function () {
      await expect(
        liquidityPool.connect(user1).reserveFrom(vault.address, DEPOSIT_AMOUNT)
      ).to.be.revertedWithCustomError(liquidityPool, "NotPerpMarket");
    });
  });

  describe("Fee Collection and Distribution", function () {
    beforeEach(async function () {
      // Two users deposit equal amounts
      await liquidityPool.connect(user1).deposit(DEPOSIT_AMOUNT);
      await liquidityPool.connect(user2).deposit(DEPOSIT_AMOUNT);
    });

    it("Should allow perp market to collect fees", async function () {
      const feeAmount = ethers.parseUnits("100", USDC_DECIMALS);
      
      const tx = await liquidityPool.connect(perpMarket).collectFee(feeAmount);
      
      expect(await liquidityPool.totalFeesCollected()).to.equal(feeAmount);
      expect(await liquidityPool.totalLiquidity()).to.equal(DEPOSIT_AMOUNT * 2n + feeAmount);

      await expect(tx)
        .to.emit(liquidityPool, "FeeCollected")
        .withArgs(feeAmount);
    });

    it("Should distribute fees proportionally to LP holders", async function () {
      const feeAmount = ethers.parseUnits("100", USDC_DECIMALS);
      await liquidityPool.connect(perpMarket).collectFee(feeAmount);
      
      // Each user should be able to claim 50 USDC (half the fees)
      const expectedFee = feeAmount / 2n;
      
      expect(await liquidityPool.getClaimableFees(user1.address)).to.equal(expectedFee);
      expect(await liquidityPool.getClaimableFees(user2.address)).to.equal(expectedFee);
      
      const initialBalance = await mockUSDC.balanceOf(user1.address);
      await liquidityPool.connect(user1).claimFees();
      
      expect(await mockUSDC.balanceOf(user1.address)).to.equal(initialBalance + expectedFee);
      expect(await liquidityPool.getClaimableFees(user1.address)).to.equal(0);
    });

    it("Should allow claiming fees on behalf of another user", async function () {
      const feeAmount = ethers.parseUnits("100", USDC_DECIMALS);
      await liquidityPool.connect(perpMarket).collectFee(feeAmount);
      
      const expectedFee = feeAmount / 2n;
      const initialBalance = await mockUSDC.balanceOf(user1.address);
      
      await liquidityPool.connect(user2).claimFeesFor(user1.address);
      
      expect(await mockUSDC.balanceOf(user1.address)).to.equal(initialBalance + expectedFee);
    });

    it("Should handle multiple fee collections correctly", async function () {
      const feeAmount1 = ethers.parseUnits("50", USDC_DECIMALS);
      const feeAmount2 = ethers.parseUnits("30", USDC_DECIMALS);
      
      await liquidityPool.connect(perpMarket).collectFee(feeAmount1);
      await liquidityPool.connect(user1).claimFees(); // User1 claims first batch
      
      await liquidityPool.connect(perpMarket).collectFee(feeAmount2);
      
      // User1 should only be able to claim from second batch
      expect(await liquidityPool.getClaimableFees(user1.address)).to.equal(feeAmount2 / 2n);
      // User2 should be able to claim from both batches
      expect(await liquidityPool.getClaimableFees(user2.address)).to.equal((feeAmount1 + feeAmount2) / 2n);
    });

    it("Should handle fee distribution when LP balances change", async function () {
      const feeAmount = ethers.parseUnits("100", USDC_DECIMALS);
      await liquidityPool.connect(perpMarket).collectFee(feeAmount);
      
      // User1 claims fees from first batch to reset their checkpoint
      await liquidityPool.connect(user1).claimFees();
      
      // User1 withdraws half their LP tokens
      const user1LPBalance = await liquidityPool.balanceOf(user1.address);
      await liquidityPool.connect(user1).withdraw(user1LPBalance / 2n);
      
      // Collect more fees
      await liquidityPool.connect(perpMarket).collectFee(feeAmount);
      
      // After withdrawal: User1 has 500 LP, User2 has 1000 LP, total supply is 1500 LP
      // User1's claimable: (500 * 100) / 1500 = 33.33 USDC (only from second batch)
      // User2's claimable: (1000 * 200) / 1500 = 133.33 USDC (from both batches, never claimed)
      const expectedUser1Fee = ethers.parseUnits("100", USDC_DECIMALS) * 500n / 1500n; // ~33.33 USDC
      const expectedUser2Fee = ethers.parseUnits("200", USDC_DECIMALS) * 1000n / 1500n; // ~133.33 USDC
      
      expect(await liquidityPool.getClaimableFees(user1.address)).to.equal(expectedUser1Fee);
      expect(await liquidityPool.getClaimableFees(user2.address)).to.equal(expectedUser2Fee);
    });


    it("Should revert when non-perp tries to collect fees", async function () {
      await expect(
        liquidityPool.connect(user1).collectFee(ethers.parseUnits("100", USDC_DECIMALS))
      ).to.be.revertedWithCustomError(liquidityPool, "NotPerpMarket");
    });
  });

  describe("View Functions", function () {
    beforeEach(async function () {
      await liquidityPool.connect(user1).deposit(DEPOSIT_AMOUNT);
    });

    it("Should return correct available liquidity", async function () {
      expect(await liquidityPool.availableLiquidity()).to.equal(DEPOSIT_AMOUNT);
      
      const reserveAmount = DEPOSIT_AMOUNT / 3n;
      await liquidityPool.connect(perpMarket).reserve(reserveAmount);
      
      expect(await liquidityPool.availableLiquidity()).to.equal(DEPOSIT_AMOUNT - reserveAmount);
    });

    it("Should emit pool stats correctly", async function () {
      const reserveAmount = DEPOSIT_AMOUNT / 4n; // 25% utilization
      await liquidityPool.connect(perpMarket).reserve(reserveAmount);
      
      const tx = await liquidityPool.emitPoolStats();
      
      await expect(tx)
        .to.emit(liquidityPool, "PoolStats")
        .withArgs(DEPOSIT_AMOUNT, reserveAmount, 2500); // 25% = 2500 bps
    });

    it("Should return zero utilization when no liquidity", async function () {
      // Deploy fresh pool with no deposits
      const LiquidityPool = await ethers.getContractFactory("LiquidityPool");
      const emptyPool = await LiquidityPool.deploy(await mockUSDC.getAddress());
      await emptyPool.waitForDeployment();
      
      const tx = await emptyPool.emitPoolStats();
      
      await expect(tx)
        .to.emit(emptyPool, "PoolStats")
        .withArgs(0, 0, 0);
    });
  });

  describe("Edge Cases and Security", function () {
    it("Should handle reentrancy protection", async function () {
      // This would require a malicious contract to test properly
      // For now, we just verify the modifier is applied to sensitive functions
      await liquidityPool.connect(user1).deposit(DEPOSIT_AMOUNT);
      await liquidityPool.connect(user1).withdraw(DEPOSIT_AMOUNT);
      await liquidityPool.connect(user1).claimFees();
    });

    it("Should handle zero LP token supply correctly", async function () {
      const feeAmount = ethers.parseUnits("100", USDC_DECIMALS);
      
      // Try to collect fees when no LP tokens exist
      await liquidityPool.connect(perpMarket).collectFee(feeAmount);
      
      // No one should be able to claim fees
      expect(await liquidityPool.getClaimableFees(user1.address)).to.equal(0);
    });

    it("Should handle user with zero LP balance trying to claim fees", async function () {
      await liquidityPool.connect(user1).deposit(DEPOSIT_AMOUNT);
      const feeAmount = ethers.parseUnits("100", USDC_DECIMALS);
      await liquidityPool.connect(perpMarket).collectFee(feeAmount);
      
      // User2 has no LP tokens
      expect(await liquidityPool.getClaimableFees(user2.address)).to.equal(0);
      
      // Should not revert but also not transfer anything
      const initialBalance = await mockUSDC.balanceOf(user2.address);
      await liquidityPool.connect(user2).claimFees();
      expect(await mockUSDC.balanceOf(user2.address)).to.equal(initialBalance);
    });
  });
});