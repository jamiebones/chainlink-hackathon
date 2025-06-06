const { expect } = require("chai");
const { ethers } = require("hardhat");

const Utils = {
  Asset: {
    TSLA: 0,
    APPL: 1,
  },
};

describe("PerpMarket (LiquidityPool-USDC Holding)", function () {
  let usdc, oracle, pool, market, vault, trader, lp;

  beforeEach(async () => {
    [vault, trader, lp] = await ethers.getSigners();

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

    await usdc.mint(lp.address, ethers.parseUnits("1000", 6));
    await usdc.connect(lp).approve(pool.target, ethers.parseUnits("1000", 6));
    await pool.connect(lp).deposit(ethers.parseUnits("1000", 6));

    await usdc.mint(trader.address, ethers.parseUnits("1000", 6));
    await usdc.connect(trader).approve(market.target, ethers.parseUnits("1000", 6));

    await usdc.mint(vault.address, ethers.parseUnits("1000", 6));
    await usdc.connect(vault).approve(market.target, ethers.parseUnits("1000", 6));
  });

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
