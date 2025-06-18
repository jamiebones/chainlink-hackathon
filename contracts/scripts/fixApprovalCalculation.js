// Analysis of your approval code and fixes needed

console.log("🔍 Approval Calculation Analysis\n");

// ================================================================
// ISSUES WITH YOUR CURRENT CODE
// ================================================================

console.log("❌ === ISSUES IN YOUR CURRENT CODE ===");

const yourCurrentCode = `
const OPEN_FEE_BPS = 10 // 10 bps = 0.1%
const openFee = (positionSize * OPEN_FEE_BPS) / 10000
const totalApproval = collateralRequired + openFee

// ISSUES:
// 1. Numbers are in JavaScript (float) but need BigInt for blockchain
// 2. Fee calculation doesn't match contract logic
// 3. Approval amount is exact, but should be unlimited
// 4. No decimal scaling consideration
`;

console.log("1. 🧮 CALCULATION MISMATCH:");
console.log("   Your JS: (positionSize * 10) / 10000");
console.log("   Contract: (sizeUsd * 10) / 10000");
console.log("   Issue: Your fee is based on positionSize, contract uses sizeUsd");

console.log("\n2. 💰 PRECISION ISSUES:");
console.log("   JavaScript floats vs BigInt precision differences");

console.log("\n3. 🔒 EXACT APPROVAL AMOUNT:");
console.log("   You're approving exact amount needed");
console.log("   Better: Approve unlimited amount (MaxUint256)");

console.log("\n4. 📊 SCALING ISSUES:");
console.log("   parseUnits(totalApproval.toString(), 6) may have precision loss");

// ================================================================
// CORRECTED VERSION
// ================================================================

console.log("\n✅ === CORRECTED APPROVAL CODE ===");

const correctedCode = `
import { parseUnits, MaxUint256 } from 'viem' // or ethers

// Option 1: Simple Unlimited Approval (Recommended)
const approveUnlimited = async () => {
  try {
    setIsLoading(true)
    await writeContractAsync({
      address: '0xDD655EC06411cA3468E641A974d66804414Cb2A2', // USDC
      abi: usdcAbi,
      functionName: 'approve',
      args: [
        '0xB9485C15cAF89Fb90be7CE14B336975F4FAE8D8f', // PerpEngine
        MaxUint256, // Unlimited approval
      ],
    })
    console.log('✅ Unlimited approval set')
  } catch (error) {
    console.error('❌ Approval failed:', error)
  } finally {
    setIsLoading(false)
  }
}

// Option 2: Calculated Approval (if you prefer exact amounts)
const approveCalculated = async (collateralRequired, sizeUsd) => {
  try {
    setIsLoading(true)
    
    // Use BigInt for precision
    const collateralBigInt = parseUnits(collateralRequired.toString(), 6)
    const sizeBigInt = parseUnits(sizeUsd.toString(), 6)
    
    // Calculate fee using contract logic
    const OPEN_FEE_BPS = 10n
    const openFee = (sizeBigInt * OPEN_FEE_BPS) / 10000n
    
    // Add buffer for safety (20% extra)
    const totalNeeded = collateralBigInt + openFee
    const totalWithBuffer = totalNeeded * 120n / 100n
    
    await writeContractAsync({
      address: '0xDD655EC06411cA3468E641A974d66804414Cb2A2',
      abi: usdcAbi,
      functionName: 'approve',
      args: [
        '0xB9485C15cAF89Fb90be7CE14B336975F4FAE8D8f',
        totalWithBuffer,
      ],
    })
    
    console.log('✅ Calculated approval set:', formatUnits(totalWithBuffer, 6))
  } catch (error) {
    console.error('❌ Approval failed:', error)
  } finally {
    setIsLoading(false)
  }
}
`;

console.log(correctedCode);

// ================================================================
// RECOMMENDED FRONTEND PATTERN
// ================================================================

console.log("\n🎯 === RECOMMENDED FRONTEND PATTERN ===");

const recommendedPattern = `
// 1. Check current allowance first
const checkAllowance = async (userAddress) => {
  try {
    const currentAllowance = await readContract({
      address: '0xDD655EC06411cA3468E641A974d66804414Cb2A2',
      abi: usdcAbi,
      functionName: 'allowance',
      args: [userAddress, '0xB9485C15cAF89Fb90be7CE14B336975F4FAE8D8f'],
    })
    
    return currentAllowance
  } catch (error) {
    console.error('Failed to check allowance:', error)
    return 0n
  }
}

// 2. Smart approval function
const ensureApproval = async (userAddress, requiredAmount) => {
  try {
    const currentAllowance = await checkAllowance(userAddress)
    
    console.log('Current allowance:', formatUnits(currentAllowance, 6), 'USDC')
    console.log('Required amount:', formatUnits(requiredAmount, 6), 'USDC')
    
    // If allowance is sufficient, no need to approve
    if (currentAllowance >= requiredAmount) {
      console.log('✅ Sufficient allowance already exists')
      return true
    }
    
    // Set unlimited allowance for better UX
    console.log('Setting unlimited allowance...')
    setIsLoading(true)
    
    await writeContractAsync({
      address: '0xDD655EC06411cA3468E641A974d66804414Cb2A2',
      abi: usdcAbi,
      functionName: 'approve',
      args: [
        '0xB9485C15cAF89Fb90be7CE14B336975F4FAE8D8f',
        MaxUint256,
      ],
    })
    
    console.log('✅ Unlimited approval set successfully')
    return true
    
  } catch (error) {
    console.error('❌ Approval failed:', error)
    return false
  } finally {
    setIsLoading(false)
  }
}

// 3. Usage in your position opening
const openPosition = async (collateralAmount, positionSize, isLong) => {
  try {
    const userAddress = await getAccount().address
    
    // Calculate total USDC needed (collateral + fee)
    const collateralBigInt = parseUnits(collateralAmount.toString(), 6)
    const sizeBigInt = parseUnits(positionSize.toString(), 6)
    const openFee = (sizeBigInt * 10n) / 10000n // 0.1% fee
    const totalNeeded = collateralBigInt + openFee
    
    // Ensure approval
    const approvalSuccess = await ensureApproval(userAddress, totalNeeded)
    if (!approvalSuccess) {
      alert('Approval failed. Please try again.')
      return
    }
    
    // Now open position
    await writeContractAsync({
      address: '0xB9485C15cAF89Fb90be7CE14B336975F4FAE8D8f',
      abi: perpEngineAbi,
      functionName: 'openPosition',
      args: [asset, collateralBigInt, sizeBigInt, isLong],
    })
    
    console.log('✅ Position opened successfully')
    
  } catch (error) {
    console.error('❌ Position opening failed:', error)
  }
}
`;

console.log(recommendedPattern);

// ================================================================
// DEBUGGING YOUR SPECIFIC CASE
// ================================================================

console.log("\n🔍 === DEBUGGING YOUR SPECIFIC CASE ===");

const debuggingSteps = `
// Add this debugging to your code:

const debugApproval = async () => {
  const userAddress = await getAccount().address
  
  console.log('=== APPROVAL DEBUGGING ===')
  console.log('User:', userAddress)
  console.log('USDC:', '0xDD655EC06411cA3468E641A974d66804414Cb2A2')
  console.log('PerpEngine:', '0xB9485C15cAF89Fb90be7CE14B336975F4FAE8D8f')
  
  // Check current allowance
  const currentAllowance = await readContract({
    address: '0xDD655EC06411cA3468E641A974d66804414Cb2A2',
    abi: usdcAbi,
    functionName: 'allowance',
    args: [userAddress, '0xB9485C15cAF89Fb90be7CE14B336975F4FAE8D8f'],
  })
  
  console.log('Current allowance:', formatUnits(currentAllowance, 6), 'USDC')
  
  // Check USDC balance
  const balance = await readContract({
    address: '0xDD655EC06411cA3468E641A974d66804414Cb2A2',
    abi: usdcAbi,
    functionName: 'balanceOf',
    args: [userAddress],
  })
  
  console.log('USDC balance:', formatUnits(balance, 6), 'USDC')
  
  // Calculate what you're trying to approve
  const collateralRequired = 100 // Your value
  const positionSize = 500 // Your value
  const openFee = (positionSize * 10) / 10000
  const totalApproval = collateralRequired + openFee
  
  console.log('Calculated approval amount:', totalApproval, 'USDC')
  console.log('In wei:', parseUnits(totalApproval.toString(), 6))
  
  // This will show you if there's a mismatch
}

// Run this before your approval transaction
await debugApproval()
`;

console.log(debuggingSteps);

// ================================================================
// QUICK FIXES TO TRY
// ================================================================

console.log("\n🚑 === QUICK FIXES TO TRY ===");

console.log("1. 🔄 Use unlimited approval instead:");
console.log("   args: [perpEngineAddress, MaxUint256]");

console.log("\n2. 🧮 Fix fee calculation:");
console.log("   Use sizeUsd instead of positionSize for fee");

console.log("\n3. 📊 Add buffer to approval:");
console.log("   const buffered = totalApproval * 1.2 // 20% extra");

console.log("\n4. 🔍 Check approval amount format:");
console.log("   console.log(parseUnits(totalApproval.toString(), 6))");

console.log("\n5. ⚡ Test with simple unlimited approval first:");
const simpleTest = `
// Simple test - just approve unlimited amount
await writeContractAsync({
  address: '0xDD655EC06411cA3468E641A974d66804414Cb2A2',
  abi: usdcAbi,
  functionName: 'approve',
  args: ['0xB9485C15cAF89Fb90be7CE14B336975F4FAE8D8f', MaxUint256],
})
`;
console.log(simpleTest);

console.log("\n✨ Analysis complete!");