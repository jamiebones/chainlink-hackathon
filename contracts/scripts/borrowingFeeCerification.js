const { ethers } = require("hardhat");

function verifyBorrowingFeeCalculation() {
  console.log("🧮 Borrowing Fee Calculation Verification\n");

  // ================================================================
  // EXAMPLE PARAMETERS
  // ================================================================
  
  console.log("📋 === EXAMPLE PARAMETERS ===");
  
  const positionSize = ethers.parseUnits("1000", 6); // 1000 USD position
  const borrowingRateAnnualBps = 1000n; // 10% annual rate (1000 bps)
  const elapsedSeconds = 3600n; // 1 hour = 3600 seconds
  
  console.log(`Position Size: ${ethers.formatUnits(positionSize, 6)} USD`);
  console.log(`Annual Borrowing Rate: ${borrowingRateAnnualBps} bps (${Number(borrowingRateAnnualBps) / 100}%)`);
  console.log(`Time Elapsed: ${elapsedSeconds} seconds (${Number(elapsedSeconds) / 3600} hours)`);

  // ================================================================
  // CONTRACT CALCULATION (Your Current Logic)
  // ================================================================
  
  console.log("\n💻 === CONTRACT CALCULATION ===");
  
  // Your contract logic:
  // fee = pos.sizeUsd * borrowingRateAnnualBps * elapsed / (365 days) / 10000;
  
  const secondsPerYear = 365n * 24n * 3600n; // 365 days in seconds
  console.log(`Seconds per year: ${secondsPerYear}`);
  
  // Step by step calculation
  const step1 = positionSize * borrowingRateAnnualBps * elapsedSeconds;
  console.log(`Step 1: ${positionSize} * ${borrowingRateAnnualBps} * ${elapsedSeconds} = ${step1}`);
  
  const step2 = step1 / secondsPerYear;
  console.log(`Step 2: ${step1} / ${secondsPerYear} = ${step2}`);
  
  const contractFee = step2 / 10000n;
  console.log(`Step 3: ${step2} / 10000 = ${contractFee}`);
  
  console.log(`\n📊 Contract Result: ${ethers.formatUnits(contractFee, 6)} USDC`);

  // ================================================================
  // MANUAL VERIFICATION (Expected Calculation)
  // ================================================================
  
  console.log("\n✅ === MANUAL VERIFICATION ===");
  
  // Expected logic:
  // Annual fee = Position Size × Annual Rate
  // Hourly fee = Annual fee ÷ (365 × 24)
  // Actual fee = Hourly fee × Hours elapsed
  
  const positionSizeFloat = 1000; // USD
  const annualRatePercent = 10; // 10%
  const hoursElapsed = 1; // 1 hour
  
  console.log("Manual calculation:");
  console.log(`1. Annual fee = ${positionSizeFloat} USD × ${annualRatePercent}% = ${positionSizeFloat * annualRatePercent / 100} USD`);
  
  const annualFee = positionSizeFloat * annualRatePercent / 100;
  console.log(`2. Annual fee = ${annualFee} USD`);
  
  const hoursPerYear = 365 * 24;
  const hourlyFee = annualFee / hoursPerYear;
  console.log(`3. Hourly fee = ${annualFee} USD ÷ ${hoursPerYear} hours = ${hourlyFee} USD`);
  
  const actualFee = hourlyFee * hoursElapsed;
  console.log(`4. Actual fee = ${hourlyFee} USD × ${hoursElapsed} hour = ${actualFee} USD`);
  
  console.log(`\n📊 Expected Result: ${actualFee.toFixed(8)} USD`);

  // ================================================================
  // COMPARISON
  // ================================================================
  
  console.log("\n🔍 === COMPARISON ===");
  
  const contractFeeFloat = Number(ethers.formatUnits(contractFee, 6));
  const difference = Math.abs(contractFeeFloat - actualFee);
  const percentDifference = (difference / actualFee) * 100;
  
  console.log(`Contract calculation: ${contractFeeFloat.toFixed(8)} USD`);
  console.log(`Expected calculation: ${actualFee.toFixed(8)} USD`);
  console.log(`Difference: ${difference.toFixed(8)} USD`);
  console.log(`Percent difference: ${percentDifference.toFixed(4)}%`);
  
  if (percentDifference < 0.001) {
    console.log("✅ CALCULATION IS CORRECT!");
  } else {
    console.log("❌ CALCULATION HAS ISSUES!");
  }

  // ================================================================
  // EDGE CASES AND POTENTIAL ISSUES
  // ================================================================
  
  console.log("\n⚠️  === POTENTIAL ISSUES ===");
  
  // Test with very small positions
  console.log("\n1. Testing with small position (1 USD):");
  const smallPosition = ethers.parseUnits("1", 6); // 1 USD
  const smallFee = smallPosition * borrowingRateAnnualBps * elapsedSeconds / secondsPerYear / 10000n;
  console.log(`Small position fee: ${ethers.formatUnits(smallFee, 6)} USDC`);
  
  if (smallFee == 0n) {
    console.log("⚠️  WARNING: Very small positions result in 0 fee due to integer division");
  }
  
  // Test with very long duration
  console.log("\n2. Testing with 1 year duration:");
  const oneYearSeconds = 365n * 24n * 3600n;
  const yearlyFee = positionSize * borrowingRateAnnualBps * oneYearSeconds / secondsPerYear / 10000n;
  console.log(`1-year fee: ${ethers.formatUnits(yearlyFee, 6)} USDC`);
  console.log(`Should equal 10% of position: ${ethers.formatUnits(positionSize / 10n, 6)} USDC`);
  
  if (yearlyFee == positionSize / 10n) {
    console.log("✅ Yearly calculation is correct");
  } else {
    console.log("❌ Yearly calculation is wrong");
  }
  
  // Test precision loss
  console.log("\n3. Testing precision with very short duration (1 minute):");
  const oneMinuteSeconds = 60n;
  const minuteFee = positionSize * borrowingRateAnnualBps * oneMinuteSeconds / secondsPerYear / 10000n;
  console.log(`1-minute fee: ${ethers.formatUnits(minuteFee, 6)} USDC`);
  
  if (minuteFee == 0n) {
    console.log("⚠️  WARNING: Very short durations result in 0 fee due to precision loss");
  }

  // ================================================================
  // ALTERNATIVE SAFER CALCULATION
  // ================================================================
  
  console.log("\n💡 === ALTERNATIVE SAFER CALCULATION ===");
  
  console.log("Current calculation order:");
  console.log("fee = sizeUsd * rate * elapsed / (365 days) / 10000");
  console.log("Issue: Two divisions can cause precision loss");
  
  console.log("\nRecommended calculation order:");
  console.log("fee = (sizeUsd * rate * elapsed) / (365 days * 10000)");
  
  // Safer calculation
  const saferDenominator = secondsPerYear * 10000n;
  const saferFee = (positionSize * borrowingRateAnnualBps * elapsedSeconds) / saferDenominator;
  
  console.log(`Current result: ${ethers.formatUnits(contractFee, 6)} USDC`);
  console.log(`Safer result: ${ethers.formatUnits(saferFee, 6)} USDC`);
  
  if (contractFee == saferFee) {
    console.log("✅ Both methods give same result");
  } else {
    console.log("⚠️  Different results - precision loss detected");
  }

  // ================================================================
  // REAL WORLD EXAMPLES
  // ================================================================
  
  console.log("\n🌍 === REAL WORLD EXAMPLES ===");
  
  const examples = [
    { position: "100", rate: "500", hours: "1", desc: "Small position, 5% rate, 1 hour" },
    { position: "1000", rate: "1000", hours: "24", desc: "Medium position, 10% rate, 1 day" },
    { position: "10000", rate: "1500", hours: "168", desc: "Large position, 15% rate, 1 week" },
    { position: "500", rate: "2000", hours: "720", desc: "Medium position, 20% rate, 1 month" }
  ];
  
  examples.forEach((example, index) => {
    const pos = ethers.parseUnits(example.position, 6);
    const rate = BigInt(example.rate);
    const elapsed = BigInt(example.hours) * 3600n;
    
    const fee = pos * rate * elapsed / secondsPerYear / 10000n;
    
    console.log(`\n${index + 1}. ${example.desc}:`);
    console.log(`   Position: ${example.position} USD`);
    console.log(`   Rate: ${example.rate} bps (${Number(example.rate) / 100}%)`);
    console.log(`   Duration: ${example.hours} hours`);
    console.log(`   Fee: ${ethers.formatUnits(fee, 6)} USDC`);
    
    // Calculate as percentage of position
    const feePercentage = (Number(ethers.formatUnits(fee, 6)) / Number(example.position)) * 100;
    console.log(`   Fee as % of position: ${feePercentage.toFixed(6)}%`);
  });

  console.log("\n✨ Borrowing fee verification complete!");
}

// Function to test the exact contract calculation
function testContractCalculationExact() {
  console.log("\n🎯 === TESTING EXACT CONTRACT LOGIC ===");
  
  // Simulate exact Solidity calculation
  const positionSize = 1000000000n; // 1000 USD in 6 decimals (1000 * 10^6)
  const borrowingRateAnnualBps = 1000n; // 10% annual
  const elapsed = 3600n; // 1 hour in seconds
  
  console.log("Simulating Solidity calculation:");
  console.log(`pos.sizeUsd = ${positionSize} (${ethers.formatUnits(positionSize, 6)} USD)`);
  console.log(`borrowingRateAnnualBps = ${borrowingRateAnnualBps}`);
  console.log(`elapsed = ${elapsed} seconds`);
  
  // Step by step like Solidity
  console.log("\nStep-by-step Solidity simulation:");
  
  const step1 = positionSize * borrowingRateAnnualBps;
  console.log(`1. pos.sizeUsd * borrowingRateAnnualBps = ${step1}`);
  
  const step2 = step1 * elapsed;
  console.log(`2. step1 * elapsed = ${step2}`);
  
  const daysInSeconds = 365n * 24n * 3600n;
  console.log(`3. (365 days) = ${daysInSeconds} seconds`);
  
  const step3 = step2 / daysInSeconds;
  console.log(`4. step2 / (365 days) = ${step3}`);
  
  const finalFee = step3 / 10000n;
  console.log(`5. step3 / 10000 = ${finalFee}`);
  
  console.log(`\nFinal result: ${finalFee} (${ethers.formatUnits(finalFee, 6)} USDC)`);
  
  // Verify this matches expected
  const expectedFeeFloat = (1000 * 0.10) / (365 * 24); // $1000 * 10% annual / hours per year
  console.log(`Expected: ${expectedFeeFloat.toFixed(8)} USD`);
  console.log(`Actual: ${ethers.formatUnits(finalFee, 6)} USD`);
  
  const matches = Math.abs(Number(ethers.formatUnits(finalFee, 6)) - expectedFeeFloat) < 0.0001;
  console.log(`Calculation correct: ${matches ? "✅ YES" : "❌ NO"}`);
}

// Run the verification
verifyBorrowingFeeCalculation();
testContractCalculationExact();

module.exports = {
  verifyBorrowingFeeCalculation,
  testContractCalculationExact
};