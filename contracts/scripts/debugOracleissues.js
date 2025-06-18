const { ethers } = require("hardhat");

async function checkChainlinkSubscription() {
  console.log("🔍 Checking Chainlink Functions Subscription Status...\n");

  // Chainlink Functions Router contract on Sepolia
  const FUNCTIONS_ROUTER = "0xb83E47C2bC239B3bf370bc41e1459A34b41238D0";
  const SUBSCRIPTION_ID = 15608;

  // Oracle addresses to check
  const oracles = {
    "TSLA Oracle": "0xDFAd049909571238cD283EB1Ba126BdA81AddB2f",
    "AAPL Oracle": "0x703dBC8C579fB7b35224b41aCD02D51dD86F06Dc",
    "Market Oracle": "0xc7DeeF49742b58e8Ed736333d920dD05F9cC1f54"
  };

  // Functions Router ABI (minimal - just what we need)
  const routerABI = [
    "function getSubscription(uint64 subscriptionId) external view returns (uint96 balance, uint96 reqCount, address owner, address[] memory consumers)",
    "function pendingRequestExists(uint64 subscriptionId) external view returns (bool)"
  ];

  try {
    // Connect to Functions Router
    const router = new ethers.Contract(FUNCTIONS_ROUTER, routerABI, ethers.provider);
    console.log(`📡 Connected to Functions Router: ${FUNCTIONS_ROUTER}\n`);

    // Get subscription details
    console.log(`🔍 Checking Subscription ${SUBSCRIPTION_ID}:`);
    
    try {
      const [balance, reqCount, owner, consumers] = await router.getSubscription(SUBSCRIPTION_ID);
      
      console.log(`✅ Subscription exists!`);
      console.log(`   Balance: ${ethers.formatUnits(balance, 18)} LINK`);
      console.log(`   Request Count: ${reqCount}`);
      console.log(`   Owner: ${owner}`);
      console.log(`   Consumers: ${consumers.length} contracts\n`);

      // Check if subscription has enough balance
      const balanceNumber = Number(ethers.formatUnits(balance, 18));
      if (balanceNumber < 0.1) {
        console.log(`❌ ISSUE: Low LINK balance (${balanceNumber} LINK)`);
        console.log(`💡 Add more LINK tokens to subscription 5017\n`);
      } else {
        console.log(`✅ LINK balance sufficient (${balanceNumber} LINK)\n`);
      }

      // Check if our oracles are consumers
      console.log(`📋 Consumer Analysis:`);
      for (const [name, address] of Object.entries(oracles)) {
        const isConsumer = consumers.some(c => c.toLowerCase() === address.toLowerCase());
        console.log(`${isConsumer ? "✅" : "❌"} ${name}: ${address} ${isConsumer ? "(ADDED)" : "(NOT ADDED)"}`);
        
        if (!isConsumer) {
          console.log(`   ⚠️ ${name} needs to be added as consumer!`);
        }
      }

      // Check for pending requests
      const hasPending = await router.pendingRequestExists(SUBSCRIPTION_ID);
      console.log(`\n📄 Pending Requests: ${hasPending ? "Yes" : "No"}`);

      // Summary
      console.log(`\n📊 Summary:`);
      const allAdded = Object.values(oracles).every(address => 
        consumers.some(c => c.toLowerCase() === address.toLowerCase())
      );
      
      if (balanceNumber >= 0.1 && allAdded) {
        console.log(`✅ Subscription setup looks correct!`);
        console.log(`❓ The issue might be elsewhere. Let's check API keys...`);
      } else {
        console.log(`❌ Subscription setup issues found:`);
        if (balanceNumber < 0.1) console.log(`   - Add more LINK tokens`);
        if (!allAdded) console.log(`   - Add missing consumer contracts`);
      }

    } catch (subscriptionError) {
      if (subscriptionError.message.includes("InvalidSubscription") || 
          subscriptionError.message.includes("SubscriptionNotFound")) {
        console.log(`❌ Subscription ${SUBSCRIPTION_ID} does not exist!`);
        console.log(`💡 Create a new subscription at https://functions.chain.link/`);
      } else {
        console.log(`❌ Error checking subscription: ${subscriptionError.message}`);
      }
    }

  } catch (error) {
    console.log(`❌ Failed to connect to Functions Router: ${error.message}`);
  }

  // Additional API key check
  console.log(`\n🔑 API Key Check:`);
  console.log(`Your oracles use these APIs:`);
  console.log(`- TSLA: Alpha Vantage (API key: VQCHMJ6090ZBZRLX)`);
  console.log(`- Market: Finnhub (API key: d10lgh1r01qlsac9rn90d10lgh1r01qlsac9rn9g)`);
  console.log(`\n💡 Test these APIs manually:`);
  console.log(`TSLA: https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=TSLA&apikey=VQCHMJ6090ZBZRLX`);
  console.log(`Market: https://finnhub.io/api/v1/stock/market-status?exchange=US&token=d10lgh1r01qlsac9rn90d10lgh1r01qlsac9rn9g`);
}

// Function to manually add consumers (if you have the right permissions)
async function addConsumersManually() {
  console.log("🔧 Manual Consumer Addition Guide:\n");
  
  console.log("If you're the subscription owner, you can add consumers programmatically:");
  console.log("But it's easier to use the web interface at https://functions.chain.link/\n");
  
  console.log("Web Interface Steps:");
  console.log("1. Go to https://functions.chain.link/");
  console.log("2. Connect wallet, switch to Sepolia");
  console.log("3. Find subscription 5017");
  console.log("4. Click 'Add Consumer'");
  console.log("5. Add these addresses one by one:");
  console.log("   - 0xDFAd049909571238cD283EB1Ba126BdA81AddB2f (TSLA)");
  console.log("   - 0x703dBC8C579fB7b35224b41aCD02D51dD86F06Dc (AAPL)");
  console.log("   - 0xc7DeeF49742b58e8Ed736333d920dD05F9cC1f54 (Market)");
}

async function main() {
  const action = process.argv[2];
  
  if (action === "add") {
    await addConsumersManually();
  } else {
    await checkChainlinkSubscription();
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });