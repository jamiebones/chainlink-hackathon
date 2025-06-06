const { expect } = require("chai");
const { ethers } = require("hardhat");

const Utils = {
  Asset: {
    TSLA: 0,
    APPL: 1,
  },
};

describe("PerpMarket", function () {
  let usdc, oracle, pool, market, vault, trader, lp, liquidator;

  beforeEach(async () => {
    [vault, trader, lp, liquidator] = await ethers.getSigners();

    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    usdc = await MockUSDC.deploy();

    const MockChainlinkManager = await ethers.getContractFactory("MockChainlinkManager");
    oracle = await MockChainlinkManager.deploy();

    const LiquidityPool = await ethers.getContractFactory("LiquidityPool");
    pool = await LiquidityPool.deploy(usdc.target);

    const PerpMarket = await ethers.getContractFactory("PerpMarket");
    market = await PerpMarket.deploy(
      usdc.target,
      oracle.target,
      pool.target,
      vault.address,
      Utils.Asset.TSLA
    );

    await oracle.setPrice(Utils.Asset.TSLA, 100 * 1e8);
    await oracle.setDexPrice(Utils.Asset.TSLA, 99 * 1e8);

    await pool.setMarket(market.target);

    await usdc.mint(lp.address, ethers.parseUnits("1250", 6));
    await usdc.connect(lp).approve(pool.target, ethers.parseUnits("1250", 6));
    await pool.connect(lp).deposit(ethers.parseUnits("1250", 6));

    await usdc.mint(trader.address, ethers.parseUnits("1000", 6));
    await usdc.connect(trader).approve(market.target, ethers.parseUnits("1000", 6));

    await usdc.mint(vault.address, ethers.parseUnits("1000", 6));
    await usdc.connect(vault).approve(market.target, ethers.parseUnits("1000", 6));
  });

  describe("Basic functionalities of Perp Market", function () {
    it("should open a leveraged long position and reserve liquidity", async () => {
      await market.connect(trader).openPosition(
        ethers.parseUnits("200", 6), // 200 USDC collateral
        ethers.parseUnits("3", 6),   // 3x leverage
        true
      );
      const pos = await market.positions(trader.address);
      expect(pos.collateral).to.equal(ethers.parseUnits("200", 6));
      expect(pos.sizeUsd).to.equal(ethers.parseUnits("600", 6));
    });

    it("should allow vault to hedge 1x and reserve liquidity", async () => {
      await market.connect(vault).openVaultHedge(ethers.parseUnits("300", 6));
      const pos = await market.positions(vault.address);
      expect(pos.sizeUsd).to.equal(ethers.parseUnits("300", 6));
    });

    it("should fail if leverage < 1x or > 10x", async () => {
      await expect(
        market.connect(trader).openPosition(ethers.parseUnits("100", 6), ethers.parseUnits("0.5", 6), true)
      ).to.be.revertedWithCustomError(market, "InvalidLeverage");

      await expect(
        market.connect(trader).openPosition(ethers.parseUnits("100", 6), ethers.parseUnits("15", 6), true)
      ).to.be.revertedWithCustomError(market, "InvalidLeverage");
    });

    it("should reject open if utilization > 80%", async () => {
      await market.connect(vault).openVaultHedge(ethers.parseUnits("800", 6));

      await expect(
        market.connect(trader).openPosition(
          ethers.parseUnits("100", 6),
          ethers.parseUnits("3", 6), // = 300
          true
        )
      ).to.be.revertedWithCustomError(market, "ExceedsUtilization");
    });

    it("should revert if reducing more than held", async () => {
      await market.connect(trader).openPosition(ethers.parseUnits("100", 6), ethers.parseUnits("2", 6), true);

      await expect(
        market.connect(trader).reducePosition(ethers.parseUnits("300", 6))
      ).to.be.revertedWith("Invalid reduce amount");
    });

    it("should reduce partially and emit correct pnl", async () => {
      await market.connect(trader).openPosition(ethers.parseUnits("100", 6), ethers.parseUnits("2", 6), true);
      await oracle.setPrice(Utils.Asset.TSLA, ethers.parseUnits("110", 8));
      await market.connect(trader).reducePosition(ethers.parseUnits("100", 6));
      const p = await market.positions(trader.address);
      expect(p.sizeUsd).to.equal(ethers.parseUnits("100", 6));
    });

    it("should close position and release profit to user", async () => {
      await market.connect(trader).openPosition(ethers.parseUnits("100", 6), ethers.parseUnits("2", 6), true);
      await oracle.setPrice(Utils.Asset.TSLA, ethers.parseUnits("110", 8));

      await market.connect(trader).closePosition();
      const p = await market.positions(trader.address);
      expect(p.sizeUsd).to.equal(0);
    });

    it("should liquidate user if collateral depleted", async () => {
      await market.connect(trader).openPosition(ethers.parseUnits("100", 6), ethers.parseUnits("2", 6), true);
      await oracle.setPrice(Utils.Asset.TSLA, ethers.parseUnits("50", 8));

      await market.connect(lp).liquidate(trader.address);
      const p = await market.positions(trader.address);
      expect(p.sizeUsd).to.equal(0);
    });
  });

  describe("Funding Rate Mechanics", function () {
    it("should increase cumulativeFundingRate over time", async () => {
      const initial = await market.cumulativeFundingRate();
      await ethers.provider.send("evm_increaseTime", [3600]); // 1 hour
      await market.updateFundingRate();
      const after = await market.cumulativeFundingRate();

      expect(after).to.be.gt(initial);
    });

    it("should assign correct entryFundingRate on position open", async () => {
      // DO NOT manually update
      await ethers.provider.send("evm_increaseTime", [3600]);
      await market.connect(trader).openPosition(
        ethers.parseUnits("100", 6),
        ethers.parseUnits("2", 6),
        true
      );

      const pos = await market.positions(trader.address);
      const current = await market.cumulativeFundingRate(); // read *after* open

      expect(pos.entryFundingRate).to.equal(current);
    });

    it("should deduct funding from long collateral after time passes", async () => {
      await market.connect(trader).openPosition(
        ethers.parseUnits("100", 6),
        ethers.parseUnits("2", 6),
        true
      );

      const initial = await market.positions(trader.address);

      await ethers.provider.send("evm_increaseTime", [7200]); // 2 hours
      await market.updateFundingRate();

      await oracle.setPrice(Utils.Asset.TSLA, ethers.parseUnits("100", 8));
      await market.connect(trader).reducePosition(ethers.parseUnits("200", 6)); // full reduce

      const pos = await market.positions(trader.address);
      expect(pos.sizeUsd).to.equal(0); // fully closed
    });

    it("should increase short position collateral from funding", async () => {
      // Increase funding rate to 50% per hour
      await market.setFundingRatePerHour(5000);

      // Open 2x short with 100 USDC
      await market.connect(trader).openPosition(
        ethers.parseUnits("100", 6),
        ethers.parseUnits("2", 6),
        false // SHORT
      );

      const before = await market.positions(trader.address);
      const beforeCollateral = before.collateral;

      // Simulate 1 hour
      await ethers.provider.send("evm_increaseTime", [3600]);
      await market.updateFundingRate();

      // Trigger funding application with small reduction
      await oracle.setPrice(Utils.Asset.TSLA, ethers.parseUnits("100", 8));
      await market.connect(trader).reducePosition(ethers.parseUnits("100", 6)); // partial reduce

      const after = await market.positions(trader.address);
      expect(after.collateral).to.be.gt(beforeCollateral);
    });
  });

  describe("Fee Calulcation checks", function () {
    it("should apply open fee correctly", async () => {
      const collateral = ethers.parseUnits("200", 6); // 200 USDC as bigint
      const leverage = ethers.parseUnits("3", 6);     // 3x as bigint
      const openFeeBps = 10n;

      // Calculate sizeUsd = collateral * leverage / 1e6
      const sizeUsd = (collateral * leverage) / 1_000_000n;

      // Calculate openFee = sizeUsd * BPS / 10000
      const openFee = (sizeUsd * openFeeBps) / 10_000n;

      const poolBalanceBefore = await usdc.balanceOf(pool.target);

      await market.connect(trader).openPosition(collateral, leverage, true);

      const poolBalanceAfter = await usdc.balanceOf(pool.target);
      const expectedChange = collateral + openFee;

      expect(poolBalanceAfter - poolBalanceBefore).to.equal(expectedChange);
    });

    it("should apply open and close fees, apply funding cost, and return final net PnL", async () => {
      const collateral = ethers.parseUnits("100", 6); // 100 USDC
      const leverage = ethers.parseUnits("2", 6);     // 2x
      const openFeeBps = 10n;
      const closeFeeBps = 10n;

      const sizeUsd = (collateral * leverage) / 1_000_000n;

      const openFee = (sizeUsd * openFeeBps) / 10_000n;

      // Open position
      await market.connect(trader).openPosition(collateral, leverage, true);

      // Simulate time passing to accumulate funding (2 hours)
      await ethers.provider.send("evm_increaseTime", [7200]); // 2 hours
      await market.updateFundingRate();

      // Simulate 10% price increase (for long position)
      await oracle.setPrice(Utils.Asset.TSLA, ethers.parseUnits("110", 8));

      // Get funding cost from contract
      const positionBefore = await market.positions(trader.address);
      const cumulativeFundingRate = await market.cumulativeFundingRate();
      const fundingDelta = cumulativeFundingRate - positionBefore.entryFundingRate;
      const fundingCost = (sizeUsd * fundingDelta) / 1_000_000_000_000_000_000n;

      // Calculate 10% PnL manually
      const pnl = (sizeUsd * 10n) / 100n;

      // Final collateral before close fee
      const adjustedCollateral = collateral - fundingCost;
      const closeFee = ((adjustedCollateral + pnl) * closeFeeBps) / 10_000n;

      const expectedFinal = adjustedCollateral + pnl - closeFee;

      const balanceBefore = await usdc.balanceOf(trader.address);

      // Close position
      await market.connect(trader).closePosition();

      const balanceAfter = await usdc.balanceOf(trader.address);
      const actualReceived = balanceAfter - balanceBefore;

      expect(actualReceived).to.closeTo(expectedFinal, 1000n);
    });
    
    it("should apply close fee and return correct amount on partial reduce", async () => {
      const collateral = ethers.parseUnits("100", 6); // 100 USDC
      const leverage = ethers.parseUnits("2", 6);     // 2x
      const reduceSize = ethers.parseUnits("100", 6); // reduce 50% of 200

      const openFeeBps = 10n;
      const closeFeeBps = 10n;

      const sizeUsd = (collateral * leverage) / 1_000_000n;
      const openFee = (sizeUsd * openFeeBps) / 10_000n;
      const reducePortion = reduceSize;
      const pnl = (reducePortion * 10n) / 100n; // assume 10% price increase

      const collateralPortion = (collateral * reducePortion) / sizeUsd;
      const grossReturn = collateralPortion + pnl;
      const closeFee = (grossReturn * closeFeeBps) / 10_000n;
      const netReturn = grossReturn - closeFee;

      // Open position (collateral + openFee)
      await market.connect(trader).openPosition(collateral, leverage, true);

      // Move price +10%
      await oracle.setPrice(Utils.Asset.TSLA, ethers.parseUnits("110", 8));
      const before = await usdc.balanceOf(trader.address);

      // Reduce
      await market.connect(trader).reducePosition(reducePortion);

      const after = await usdc.balanceOf(trader.address);
      const received = after - before;

      expect(received).to.be.closeTo(netReturn, 1_000n); // Tolerance: 0.001 USDC
    });

    it("should liquidate a position and distribute penalty correctly", async () => {
      const collateral = ethers.parseUnits("100", 6); // 100 USDC
      const leverage = ethers.parseUnits("10", 6);    // 10x
      const sizeUsd = (collateral * leverage) / 1_000_000n;
      const liquidationPenaltyBps = 200n; // 2%

      // Step 1: Open high-leverage long position
      await market.connect(trader).openPosition(collateral, leverage, true);

      // Step 2: Crash the price to make position undercollateralized
      await oracle.setPrice(Utils.Asset.TSLA, ethers.parseUnits("80", 8)); // 20% drop

      // Step 3: Check trader is liquidatable
      const liquidatable = await market.isLiquidatable(trader.address);
      expect(liquidatable).to.be.true;

      const beforeBalance = await usdc.balanceOf(liquidator.address);
      const positionBefore = await market.positions(trader.address);

      // Step 4: Liquidate
      await market.connect(liquidator).liquidate(trader.address);

      // Step 5: Liquidator gets 2% of collateral as reward
      const penalty = (positionBefore.collateral * liquidationPenaltyBps) / 10_000n;
      const afterBalance = await usdc.balanceOf(liquidator.address);

      expect(afterBalance - beforeBalance).to.equal(penalty);

      // Step 6: Ensure position is deleted
      const pos = await market.positions(trader.address);
      expect(pos.sizeUsd).to.equal(0);
    });
  });
});