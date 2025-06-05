const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("LiquidityPool", function () {
  let usdc, pool, lpToken, owner, alice, bob, market;

  beforeEach(async () => {
    [owner, alice, bob, market] = await ethers.getSigners();

    const USDC = await ethers.getContractFactory("MockUSDC");
    usdc = await USDC.deploy();
    await usdc.mint(alice.address, ethers.parseUnits("1000", 6));
    await usdc.mint(bob.address, ethers.parseUnits("1000", 6));

    const LiquidityPool = await ethers.getContractFactory("LiquidityPool");
    pool = await LiquidityPool.deploy(usdc.target);

    const lpAddr = await pool.lpToken();
    const LPToken = await ethers.getContractFactory("LPToken");
    lpToken = await LPToken.attach(lpAddr);

    await usdc.connect(alice).approve(pool.target, ethers.parseUnits("1000", 6));
    await usdc.connect(bob).approve(pool.target, ethers.parseUnits("1000", 6));
  });

  it("should mint LP tokens on deposit", async () => {
    await pool.connect(alice).deposit(ethers.parseUnits("500", 6));
    const balance = await lpToken.balanceOf(alice.address);
    expect(balance).to.equal(ethers.parseUnits("500", 6));
  });

  it("should withdraw USDC and burn LP tokens", async () => {
    await pool.connect(alice).deposit(ethers.parseUnits("500", 6));
    const lpBal = await lpToken.balanceOf(alice.address);
    await lpToken.connect(alice).approve(pool.target, lpBal);
    await pool.connect(alice).withdraw(lpBal);

    const usdcBal = await usdc.balanceOf(alice.address);
    expect(usdcBal).to.equal(ethers.parseUnits("1000", 6));
  });

  it("should fail withdrawal if not enough LP shares", async () => {
    await pool.connect(alice).deposit(ethers.parseUnits("500", 6));
    await expect(
      pool.connect(bob).withdraw(ethers.parseUnits("10", 6))
    ).to.be.revertedWithCustomError(pool, "InsufficientShares");
  });

  it("should fail withdrawal if liquidity is reserved", async () => {
    await pool.connect(alice).deposit(ethers.parseUnits("1000", 6));
    await pool.setMarket(market.address);
    await pool.connect(market).reserve(ethers.parseUnits("800", 6));

    const lpBal = await lpToken.balanceOf(alice.address);
    await lpToken.connect(alice).approve(pool.target, lpBal);
    await expect(pool.connect(alice).withdraw(lpBal)).to.be.revertedWithCustomError(
      pool,
      "InsufficientFreeLiquidity"
    );
  });

  it("should allow market to reserve and release liquidity", async () => {
    await pool.connect(alice).deposit(ethers.parseUnits("1000", 6));
    await pool.setMarket(market.address);

    await expect(pool.connect(market).reserve(ethers.parseUnits("600", 6)))
      .to.emit(pool, "Reserve");

    await expect(pool.connect(market).release(ethers.parseUnits("300", 6)))
      .to.emit(pool, "Release");
  });

  it("should revert if non-market tries to reserve", async () => {
    await pool.connect(alice).deposit(ethers.parseUnits("1000", 6));
    await pool.setMarket(market.address);

    await expect(
      pool.connect(bob).reserve(ethers.parseUnits("100", 6))
    ).to.be.revertedWithCustomError(pool, "OnlyMarket");
  });

  it("should revert if release exceeds reserved", async () => {
    await pool.connect(alice).deposit(ethers.parseUnits("1000", 6));
    await pool.setMarket(market.address);
    await pool.connect(market).reserve(ethers.parseUnits("200", 6));

    await expect(
      pool.connect(market).release(ethers.parseUnits("500", 6))
    ).to.be.revertedWithCustomError(pool, "NotReserved");
  });

  it("should only allow market to be set once", async () => {
    await pool.setMarket(market.address);
    await expect(pool.setMarket(bob.address)).to.be.revertedWithCustomError(pool, "AlreadySet");
  });

  it("should fail deposit with 0 amount", async () => {
    await expect(pool.connect(alice).deposit(0)).to.be.revertedWithCustomError(pool, "ZeroAmount");
  });

  it("should fail withdraw with 0 shares", async () => {
    await expect(pool.connect(alice).withdraw(0)).to.be.revertedWithCustomError(pool, "ZeroAmount");
  });
});
