// const { ethers } = require("hardhat");
// const { loadDeployment } = require("./deploymentUtils");

// // Color codes for better output
// const colors = {
//   reset: "\x1b[0m",
//   bright: "\x1b[1m",
//   green: "\x1b[32m",
//   yellow: "\x1b[33m",
//   red: "\x1b[31m",
//   cyan: "\x1b[36m",
//   magenta: "\x1b[35m"
// };

// // Constants
// const USDC_DECIMALS = 6;
// const SYNTH_DECIMALS = 18;
// const Asset = {
//   TSLA: 0,
//   APPL: 1
// };

// // Helper functions
// const toUSDC = (amount) => ethers.parseUnits(amount.toString(), USDC_DECIMALS);
// const toSynth = (amount) => ethers.parseUnits(amount.toString(), SYNTH_DECIMALS);
// const fromUSDC = (amount) => ethers.formatUnits(amount, USDC_DECIMALS);
// const fromSynth = (amount) => ethers.formatUnits(amount, SYNTH_DECIMALS);

// // ========================================
// // SYNTHETIC ASSET OPERATIONS
// // ========================================

// /**
//  * Mint synthetic assets (sTSLA or sAPPL)
//  * @param {string} asset - "TSLA" or "APPL"
//  * @param {number} amount - Amount of synthetic tokens to mint
//  * @param {Object} signer - Ethers signer object
//  */
// async function mintSynthetic(asset, amount, signer) {
//   console.log(`\n${colors.cyan}🪙 Minting ${amount} s${asset}...${colors.reset}\n`);

//   const deployment = await loadDeployment((await ethers.provider.getNetwork()).name);
//   const vault = await ethers.getContractAt("Vault", deployment.contracts.vault, signer);
//   const usdc = await ethers.getContractAt("IERC20", deployment.contracts.usdc, signer);
//   const chainlinkManager = await ethers.getContractAt("ChainlinkManager", deployment.contracts.chainlinkManager);
  
//   const assetType = asset === "TSLA" ? Asset.TSLA : Asset.APPL;
//   const synthToken = asset === "TSLA" ? deployment.contracts.sTSLA : deployment.contracts.sAPPL;
//   const sToken = await ethers.getContractAt("IERC20", synthToken, signer);

//   try {
//     // Check market status
//     const isMarketOpen = await chainlinkManager.isMarketOpen();
//     if (!isMarketOpen) {
//       console.log(`${colors.red}❌ Market is closed. Cannot mint during off-hours.${colors.reset}`);
//       return;
//     }

//     // Get current price
//     const oraclePrice = await chainlinkManager.getPrice(assetType);
//     const priceInUSD = Number(oraclePrice) / 1e18;
//     console.log(`Current ${asset} price: $${priceInUSD.toFixed(2)}`);

//     // Calculate required USDC (110% collateral)
//     const amountInSynth = toSynth(amount);
//     const notionalValue = (amountInSynth * oraclePrice) / ethers.parseUnits("1", 18);
//     const notionalUSDC = notionalValue / BigInt(10 ** 12); // Convert to USDC decimals
//     const requiredCollateral = (notionalUSDC * 110n) / 100n;
    
//     // Get mint fee
//     const dexPrice = await chainlinkManager.getTwapPriceofAsset(assetType);
//     const mintFeePercent = await vault._calculateMintFee(dexPrice, oraclePrice);
//     const mintFee = (notionalUSDC * mintFeePercent) / ethers.parseUnits("1", 18);
//     const totalRequired = requiredCollateral + mintFee;

//     console.log(`${colors.yellow}📊 Transaction Details:${colors.reset}`);
//     console.log(`  Notional Value: $${fromUSDC(notionalUSDC)}`);
//     console.log(`  Required Collateral (110%): ${fromUSDC(requiredCollateral)} USDC`);
//     console.log(`  Mint Fee: ${fromUSDC(mintFee)} USDC (${Number(mintFeePercent) / 1e16}%)`);
//     console.log(`  Total Required: ${fromUSDC(totalRequired)} USDC`);

//     // Check user balance
//     const userBalance = await usdc.balanceOf(signer.address);
//     if (userBalance < totalRequired) {
//       console.log(`${colors.red}❌ Insufficient USDC balance. Need ${fromUSDC(totalRequired)}, have ${fromUSDC(userBalance)}${colors.reset}`);
//       return;
//     }

//     // Approve vault
//     console.log(`\n${colors.yellow}Approving USDC...${colors.reset}`);
//     const approveTx = await usdc.approve(vault.target, totalRequired);
//     await approveTx.wait();

//     // Mint synthetic tokens
//     console.log(`${colors.yellow}Minting s${asset}...${colors.reset}`);
//     const mintTx = await vault.openPosition(assetType, amountInSynth);
//     const receipt = await mintTx.wait();

//     // Get final balance
//     const synthBalance = await sToken.balanceOf(signer.address);
    
//     console.log(`\n${colors.green}✅ Mint successful!${colors.reset}`);
//     console.log(`  Transaction: ${receipt.hash}`);
//     console.log(`  Gas used: ${receipt.gasUsed.toString()}`);
//     console.log(`  Your s${asset} balance: ${fromSynth(synthBalance)}`);

//     return receipt;

//   } catch (error) {
//     console.error(`${colors.red}❌ Mint failed: ${error.message}${colors.reset}`);
//     throw error;
//   }
// }

// /**
//  * Redeem synthetic assets for USDC
//  * @param {string} asset - "TSLA" or "APPL"
//  * @param {number} amount - Amount of synthetic tokens to redeem
//  * @param {Object} signer - Ethers signer object
//  */
// async function redeemSynthetic(asset, amount, signer) {
//   console.log(`\n${colors.cyan}💰 Redeeming ${amount} s${asset}...${colors.reset}\n`);

//   const deployment = await loadDeployment((await ethers.provider.getNetwork()).name);
//   const vault = await ethers.getContractAt("Vault", deployment.contracts.vault, signer);
//   const usdc = await ethers.getContractAt("IERC20", deployment.contracts.usdc, signer);
//   const chainlinkManager = await ethers.getContractAt("ChainlinkManager", deployment.contracts.chainlinkManager);
  
//   const assetType = asset === "TSLA" ? Asset.TSLA : Asset.APPL;
//   const synthToken = asset === "TSLA" ? deployment.contracts.sTSLA : deployment.contracts.sAPPL;
//   const sToken = await ethers.getContractAt("IERC20", synthToken, signer);

//   try {
//     // Check market status
//     const isMarketOpen = await chainlinkManager.isMarketOpen();
//     if (!isMarketOpen) {
//       console.log(`${colors.red}❌ Market is closed. Cannot redeem during off-hours.${colors.reset}`);
//       return;
//     }

//     // Check user balance
//     const amountInSynth = toSynth(amount);
//     const userBalance = await sToken.balanceOf(signer.address);
//     if (userBalance < amountInSynth) {
//       console.log(`${colors.red}❌ Insufficient s${asset} balance. Have ${fromSynth(userBalance)}${colors.reset}`);
//       return;
//     }

//     // Get current price and calculate redemption value
//     const oraclePrice = await chainlinkManager.getPrice(assetType);
//     const dexPrice = await chainlinkManager.getTwapPriceofAsset(assetType);
//     const priceInUSD = Number(oraclePrice) / 1e18;
    
//     const redemptionValue = (amountInSynth * oraclePrice) / ethers.parseUnits("1", 18);
//     const redemptionUSDC = redemptionValue / BigInt(10 ** 12);
    
//     // Calculate redemption fee
//     const redeemFeePercent = await vault._calculateRedeemFee(oraclePrice, dexPrice);
//     const redeemFee = (redemptionUSDC * redeemFeePercent) / ethers.parseUnits("1", 18);
//     const expectedReturn = redemptionUSDC - redeemFee;

//     console.log(`${colors.yellow}📊 Redemption Details:${colors.reset}`);
//     console.log(`  Current ${asset} price: $${priceInUSD.toFixed(2)}`);
//     console.log(`  Redemption Value: ${fromUSDC(redemptionUSDC)} USDC`);
//     console.log(`  Redemption Fee: ${fromUSDC(redeemFee)} USDC (${Number(redeemFeePercent) / 1e16}%)`);
//     console.log(`  Expected Return: ${fromUSDC(expectedReturn)} USDC`);

//     // Get USDC balance before
//     const usdcBefore = await usdc.balanceOf(signer.address);

//     // Redeem
//     console.log(`\n${colors.yellow}Redeeming s${asset}...${colors.reset}`);
//     const redeemTx = await vault.redeemStock(assetType, amountInSynth);
//     const receipt = await redeemTx.wait();

//     // Get USDC balance after
//     const usdcAfter = await usdc.balanceOf(signer.address);
//     const actualReceived = usdcAfter - usdcBefore;

//     console.log(`\n${colors.green}✅ Redemption successful!${colors.reset}`);
//     console.log(`  Transaction: ${receipt.hash}`);
//     console.log(`  Gas used: ${receipt.gasUsed.toString()}`);
//     console.log(`  USDC received: ${fromUSDC(actualReceived)}`);
//     console.log(`  Your USDC balance: ${fromUSDC(usdcAfter)}`);

//     return receipt;

//   } catch (error) {
//     console.error(`${colors.red}❌ Redemption failed: ${error.message}${colors.reset}`);
//     throw error;
//   }
// }

// // ========================================
// // PERPETUAL TRADING OPERATIONS
// // ========================================

// /**
//  * Open a perpetual position
//  * @param {string} asset - "TSLA" or "APPL"
//  * @param {number} collateral - USDC collateral amount
//  * @param {number} leverage - Leverage (1-10)
//  * @param {boolean} isLong - true for long, false for short
//  * @param {Object} signer - Ethers signer object
//  */
// async function openPerpPosition(asset, collateral, leverage, isLong, signer) {
//   console.log(`\n${colors.cyan}📈 Opening ${isLong ? 'LONG' : 'SHORT'} position...${colors.reset}\n`);

//   const deployment = await loadDeployment((await ethers.provider.getNetwork()).name);
//   const perpEngine = await ethers.getContractAt("PerpEngine", deployment.contracts.perpEngine, signer);
//   const usdc = await ethers.getContractAt("IERC20", deployment.contracts.usdc, signer);
//   const chainlinkManager = await ethers.getContractAt("ChainlinkManager", deployment.contracts.chainlinkManager);
  
//   const assetType = asset === "TSLA" ? Asset.TSLA : Asset.APPL;

//   try {
//     // Check if paused
//     const isPaused = await perpEngine.isPaused();
//     if (isPaused) {
//       console.log(`${colors.red}❌ PerpEngine is paused.${colors.reset}`);
//       return;
//     }

//     // Calculate position size
//     const collateralAmount = toUSDC(collateral);
//     const positionSize = toUSDC(collateral * leverage);

//     // Get current price
//     const oraclePrice = await chainlinkManager.getPrice(assetType);
//     const priceInUSD = Number(oraclePrice) / 1e18;

//     // Calculate fees
//     const openFee = (positionSize * 10n) / 10000n; // 0.1%
//     const totalRequired = collateralAmount + openFee;

//     console.log(`${colors.yellow}📊 Position Details:${colors.reset}`);
//     console.log(`  Asset: ${asset}`);
//     console.log(`  Current Price: $${priceInUSD.toFixed(2)}`);
//     console.log(`  Direction: ${isLong ? 'LONG 📈' : 'SHORT 📉'}`);
//     console.log(`  Collateral: ${collateral} USDC`);
//     console.log(`  Leverage: ${leverage}x`);
//     console.log(`  Position Size: ${fromUSDC(positionSize)} USDC`);
//     console.log(`  Open Fee: ${fromUSDC(openFee)} USDC`);
//     console.log(`  Total Required: ${fromUSDC(totalRequired)} USDC`);

//     // Check balance
//     const userBalance = await usdc.balanceOf(signer.address);
//     if (userBalance < totalRequired) {
//       console.log(`${colors.red}❌ Insufficient USDC. Need ${fromUSDC(totalRequired)}, have ${fromUSDC(userBalance)}${colors.reset}`);
//       return;
//     }

//     // Approve PerpEngine
//     console.log(`\n${colors.yellow}Approving USDC...${colors.reset}`);
//     const approveTx = await usdc.approve(perpEngine.target, totalRequired);
//     await approveTx.wait();

//     // Open position
//     console.log(`${colors.yellow}Opening position...${colors.reset}`);
//     const openTx = await perpEngine.openPosition(
//       assetType,
//       collateralAmount,
//       positionSize,
//       isLong
//     );
//     const receipt = await openTx.wait();

//     // Get position details
//     const position = await perpEngine.getPosition(signer.address, assetType);

//     console.log(`\n${colors.green}✅ Position opened successfully!${colors.reset}`);
//     console.log(`  Transaction: ${receipt.hash}`);
//     console.log(`  Gas used: ${receipt.gasUsed.toString()}`);
//     console.log(`  Entry Price: $${priceInUSD.toFixed(2)}`);
//     console.log(`  Liquidation Price: $${await calculateLiquidationPrice(perpEngine, signer.address, assetType)}`);

//     return receipt;

//   } catch (error) {
//     console.error(`${colors.red}❌ Failed to open position: ${error.message}${colors.reset}`);
//     throw error;
//   }
// }

// /**
//  * Close a perpetual position
//  * @param {string} asset - "TSLA" or "APPL"
//  * @param {Object} signer - Ethers signer object
//  */
// async function closePerpPosition(asset, signer) {
//   console.log(`\n${colors.cyan}📉 Closing position...${colors.reset}\n`);

//   const deployment = await loadDeployment((await ethers.provider.getNetwork()).name);
//   const perpEngine = await ethers.getContractAt("PerpEngine", deployment.contracts.perpEngine, signer);
//   const usdc = await ethers.getContractAt("IERC20", deployment.contracts.usdc, signer);
//   const chainlinkManager = await ethers.getContractAt("ChainlinkManager", deployment.contracts.chainlinkManager);
  
//   const assetType = asset === "TSLA" ? Asset.TSLA : Asset.APPL;

//   try {
//     // Get position
//     const position = await perpEngine.getPosition(signer.address, assetType);
//     if (position.sizeUsd == 0n) {
//       console.log(`${colors.red}❌ No open position found for ${asset}${colors.reset}`);
//       return;
//     }

//     // Get current price and PnL
//     const currentPrice = await chainlinkManager.getPrice(assetType);
//     const priceInUSD = Number(currentPrice) / 1e18;
//     const entryPriceUSD = Number(position.entryPrice) / 1e18;
//     const pnl = await perpEngine.getPnL(assetType, signer.address);

//     console.log(`${colors.yellow}📊 Position Details:${colors.reset}`);
//     console.log(`  Direction: ${position.isLong ? 'LONG 📈' : 'SHORT 📉'}`);
//     console.log(`  Size: ${fromUSDC(position.sizeUsd)} USDC`);
//     console.log(`  Collateral: ${fromUSDC(position.collateral)} USDC`);
//     console.log(`  Entry Price: $${entryPriceUSD.toFixed(2)}`);
//     console.log(`  Current Price: $${priceInUSD.toFixed(2)}`);
//     console.log(`  PnL: ${pnl >= 0 ? '+' : ''}${fromUSDC(pnl)} USDC`);

//     // Get balance before
//     const balanceBefore = await usdc.balanceOf(signer.address);

//     // Close position
//     console.log(`\n${colors.yellow}Closing position...${colors.reset}`);
//     const closeTx = await perpEngine.closePosition(assetType);
//     const receipt = await closeTx.wait();

//     // Get balance after
//     const balanceAfter = await usdc.balanceOf(signer.address);
//     const received = balanceAfter - balanceBefore;

//     console.log(`\n${colors.green}✅ Position closed successfully!${colors.reset}`);
//     console.log(`  Transaction: ${receipt.hash}`);
//     console.log(`  Gas used: ${receipt.gasUsed.toString()}`);
//     console.log(`  USDC received: ${fromUSDC(received)}`);
//     console.log(`  Final PnL: ${pnl >= 0 ? '+' : ''}${fromUSDC(pnl)} USDC`);

//     return receipt;

//   } catch (error) {
//     console.error(`${colors.red}❌ Failed to close position: ${error.message}${colors.reset}`);
//     throw error;
//   }
// }

// /**
//  * Add collateral to an existing position
//  * @param {string} asset - "TSLA" or "APPL"
//  * @param {number} amount - Amount of USDC to add
//  * @param {Object} signer - Ethers signer object
//  */
// async function addCollateral(asset, amount, signer) {
//   console.log(`\n${colors.cyan}💵 Adding collateral...${colors.reset}\n`);

//   const deployment = await loadDeployment((await ethers.provider.getNetwork()).name);
//   const perpEngine = await ethers.getContractAt("PerpEngine", deployment.contracts.perpEngine, signer);
//   const usdc = await ethers.getContractAt("IERC20", deployment.contracts.usdc, signer);
  
//   const assetType = asset === "TSLA" ? Asset.TSLA : Asset.APPL;
//   const amountUSDC = toUSDC(amount);

//   try {
//     // Check position exists
//     const position = await perpEngine.getPosition(signer.address, assetType);
//     if (position.sizeUsd == 0n) {
//       console.log(`${colors.red}❌ No open position found for ${asset}${colors.reset}`);
//       return;
//     }

//     console.log(`${colors.yellow}Current collateral: ${fromUSDC(position.collateral)} USDC${colors.reset}`);
//     console.log(`${colors.yellow}Adding: ${amount} USDC${colors.reset}`);

//     // Approve
//     const approveTx = await usdc.approve(perpEngine.target, amountUSDC);
//     await approveTx.wait();

//     // Add collateral
//     const addTx = await perpEngine.addCollateral(assetType, amountUSDC);
//     const receipt = await addTx.wait();

//     // Get updated position
//     const updatedPosition = await perpEngine.getPosition(signer.address, assetType);

//     console.log(`\n${colors.green}✅ Collateral added successfully!${colors.reset}`);
//     console.log(`  New collateral: ${fromUSDC(updatedPosition.collateral)} USDC`);
//     console.log(`  New leverage: ${(Number(updatedPosition.sizeUsd) / Number(updatedPosition.collateral)).toFixed(2)}x`);

//     return receipt;

//   } catch (error) {
//     console.error(`${colors.red}❌ Failed to add collateral: ${error.message}${colors.reset}`);
//     throw error;
//   }
// }

// // ========================================
// // LIQUIDITY PROVIDER OPERATIONS
// // ========================================

// /**
//  * Provide liquidity to the pool
//  * @param {number} amount - Amount of USDC to deposit
//  * @param {Object} signer - Ethers signer object
//  */
// async function provideLiquidity(amount, signer) {
//   console.log(`\n${colors.cyan}💧 Providing liquidity...${colors.reset}\n`);

//   const deployment = await loadDeployment((await ethers.provider.getNetwork()).name);
//   const liquidityPool = await ethers.getContractAt("LiquidityPool", deployment.contracts.liquidityPool, signer);
//   const usdc = await ethers.getContractAt("IERC20", deployment.contracts.usdc, signer);
  
//   const amountUSDC = toUSDC(amount);

//   try {
//     // Get pool stats
//     const totalLiquidity = await liquidityPool.totalLiquidity();
//     const utilization = await liquidityPool.getPoolUtilization();

//     console.log(`${colors.yellow}📊 Pool Stats:${colors.reset}`);
//     console.log(`  Total Liquidity: ${fromUSDC(totalLiquidity)} USDC`);
//     console.log(`  Utilization: ${Number(utilization) / 100}%`);
//     console.log(`  Your Deposit: ${amount} USDC`);

//     // Approve
//     console.log(`\n${colors.yellow}Approving USDC...${colors.reset}`);
//     const approveTx = await usdc.approve(liquidityPool.target, amountUSDC);
//     await approveTx.wait();

//     // Get LP token balance before
//     const lpBalanceBefore = await liquidityPool.balanceOf(signer.address);

//     // Deposit
//     console.log(`${colors.yellow}Depositing...${colors.reset}`);
//     const depositTx = await liquidityPool.deposit(amountUSDC);
//     const receipt = await depositTx.wait();

//     // Get LP token balance after
//     const lpBalanceAfter = await liquidityPool.balanceOf(signer.address);
//     const lpReceived = lpBalanceAfter - lpBalanceBefore;

//     console.log(`\n${colors.green}✅ Liquidity provided successfully!${colors.reset}`);
//     console.log(`  Transaction: ${receipt.hash}`);
//     console.log(`  LP tokens received: ${fromSynth(lpReceived)}`);
//     console.log(`  Your LP balance: ${fromSynth(lpBalanceAfter)}`);

//     return receipt;

//   } catch (error) {
//     console.error(`${colors.red}❌ Failed to provide liquidity: ${error.message}${colors.reset}`);
//     throw error;
//   }
// }

// /**
//  * Withdraw liquidity from the pool
//  * @param {number} lpAmount - Amount of LP tokens to burn
//  * @param {Object} signer - Ethers signer object
//  */
// async function withdrawLiquidity(lpAmount, signer) {
//   console.log(`\n${colors.cyan}💸 Withdrawing liquidity...${colors.reset}\n`);

//   const deployment = await loadDeployment((await ethers.provider.getNetwork()).name);
//   const liquidityPool = await ethers.getContractAt("LiquidityPool", deployment.contracts.liquidityPool, signer);
//   const usdc = await ethers.getContractAt("IERC20", deployment.contracts.usdc, signer);
  
//   const lpAmountWei = toSynth(lpAmount);

//   try {
//     // Check LP balance
//     const lpBalance = await liquidityPool.balanceOf(signer.address);
//     if (lpBalance < lpAmountWei) {
//       console.log(`${colors.red}❌ Insufficient LP tokens. Have ${fromSynth(lpBalance)}${colors.reset}`);
//       return;
//     }

//     // Calculate expected USDC
//     const totalSupply = await liquidityPool.totalSupply();
//     const totalLiquidity = await liquidityPool.totalLiquidity();
//     const expectedUSDC = (lpAmountWei * totalLiquidity) / totalSupply;

//     console.log(`${colors.yellow}📊 Withdrawal Details:${colors.reset}`);
//     console.log(`  LP tokens to burn: ${lpAmount}`);
//     console.log(`  Expected USDC: ~${fromUSDC(expectedUSDC)}`);

//     // Get balances before
//     const usdcBefore = await usdc.balanceOf(signer.address);

//     // Withdraw
//     console.log(`\n${colors.yellow}Withdrawing...${colors.reset}`);
//     const withdrawTx = await liquidityPool.withdraw(lpAmountWei);
//     const receipt = await withdrawTx.wait();

//     // Get balances after
//     const usdcAfter = await usdc.balanceOf(signer.address);
//     const usdcReceived = usdcAfter - usdcBefore;

//     console.log(`\n${colors.green}✅ Withdrawal successful!${colors.reset}`);
//     console.log(`  Transaction: ${receipt.hash}`);
//     console.log(`  USDC received: ${fromUSDC(usdcReceived)}`);
//     console.log(`  Your USDC balance: ${fromUSDC(usdcAfter)}`);

//     return receipt;

//   } catch (error) {
//     console.error(`${colors.red}❌ Failed to withdraw: ${error.message}${colors.reset}`);
//     throw error;
//   }
// }

// /**
//  * Claim accumulated fees as an LP
//  * @param {Object} signer - Ethers signer object
//  */
// async function claimLPFees(signer) {
//   console.log(`\n${colors.cyan}💰 Claiming LP fees...${colors.reset}\n`);

//   const deployment = await loadDeployment((await ethers.provider.getNetwork()).name);
//   const liquidityPool = await ethers.getContractAt("LiquidityPool", deployment.contracts.liquidityPool, signer);
//   const usdc = await ethers.getContractAt("IERC20", deployment.contracts.usdc, signer);

//   try {
//     // Check claimable fees
//     const claimable = await liquidityPool.getClaimableFees(signer.address);
    
//     if (claimable == 0n) {
//       console.log(`${colors.yellow}No fees to claim.${colors.reset}`);
//       return;
//     }

//     console.log(`${colors.yellow}Claimable fees: ${fromUSDC(claimable)} USDC${colors.reset}`);

//     // Get balance before
//     const balanceBefore = await usdc.balanceOf(signer.address);

//     // Claim fees
//     const claimTx = await liquidityPool.claimFees();
//     const receipt = await claimTx.wait();

//     // Get balance after
//     const balanceAfter = await usdc.balanceOf(signer.address);
//     const received = balanceAfter - balanceBefore;

//     console.log(`\n${colors.green}✅ Fees claimed successfully!${colors.reset}`);
//     console.log(`  Transaction: ${receipt.hash}`);
//     console.log(`  USDC received: ${fromUSDC(received)}`);

//     return receipt;

//   } catch (error) {
//     console.error(`${colors.red}❌ Failed to claim fees: ${error.message}${colors.reset}`);
//     throw error;
//   }
// }

// module.exports = {
//   depositLiquidity,
//   withdrawLiquidity,
//   claimLPFees
// };