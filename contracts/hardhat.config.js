require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

// Ensure required environment variables are set
const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY || "0x0000000000000000000000000000000000000000000000000000000000000000";
const LP_PROVIDER_PRIVATE_KEY = process.env.LP_PROVIDER_PRIVATE_KEY || DEPLOYER_PRIVATE_KEY;
const FEE_RECEIVER_PRIVATE_KEY = process.env.FEE_RECEIVER_PRIVATE_KEY || DEPLOYER_PRIVATE_KEY;

// RPC URLs with fallbacks
const ARBITRUM_RPC_URL = process.env.ARBITRUM_RPC_URL || "https://arb1.arbitrum.io/rpc";
const ARBITRUM_SEPOLIA_RPC_URL = process.env.ARBITRUM_SEPOLIA_RPC_URL || "https://sepolia-rollup.arbitrum.io/rpc";
const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL || "https://eth-sepolia.g.alchemy.com/v2/demo";
const MAINNET_RPC_URL = process.env.MAINNET_RPC_URL || "https://eth-mainnet.g.alchemy.com/v2/demo";
const OPTIMISM_RPC_URL = process.env.OPTIMISM_RPC_URL || "https://mainnet.optimism.io";
const POLYGON_RPC_URL = process.env.POLYGON_RPC_URL || "https://polygon-rpc.com";
const BASE_RPC_URL = process.env.BASE_RPC_URL || "https://mainnet.base.org";
const BSC_RPC_URL = process.env.BSC_RPC_URL || "https://bsc-dataseed.binance.org";
const AVALANCHE_RPC_URL = process.env.AVALANCHE_RPC_URL || "https://api.avax.network/ext/bc/C/rpc";

// API Keys for verification
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || "";
const ARBISCAN_API_KEY = process.env.ARBISCAN_API_KEY || "";
const OPTIMISTIC_ETHERSCAN_API_KEY = process.env.OPTIMISTIC_ETHERSCAN_API_KEY || "";
const POLYGONSCAN_API_KEY = process.env.POLYGONSCAN_API_KEY || "";
const BASESCAN_API_KEY = process.env.BASESCAN_API_KEY || "";
const BSCSCAN_API_KEY = process.env.BSCSCAN_API_KEY || "";
const SNOWTRACE_API_KEY = process.env.SNOWTRACE_API_KEY || "";

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    compilers: [
      {
        version: "0.8.28",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
          viaIR: true,
        },
      },
      {
        version: "0.8.19",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      }
    ],
  },
  
  networks: {
    // Local development
    hardhat: {
      chainId: 31337,
      router:   "0x0000000000000000000000000000000000000000",
      donId:    "0x0000000000000000000000000000000000000000000000000000000000000000",
      gasLimit: 100000,  
      forking: {
        url: ARBITRUM_RPC_URL,
        enabled: process.env.FORKING === "true",
      },
    },
    
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337,
      router:   "0x0000000000000000000000000000000000000000",
      donId:    "0x0000000000000000000000000000000000000000000000000000000000000000",
      gasLimit: 100000
    },
    
    // Arbitrum Networks
    arbitrum: {
      url: ARBITRUM_RPC_URL,
      chainId: 42161,
      accounts: [DEPLOYER_PRIVATE_KEY, LP_PROVIDER_PRIVATE_KEY, FEE_RECEIVER_PRIVATE_KEY],
      gasPrice: "auto",
      gas: "auto",

      router: "0x97083e831f8f0638855e2a515c90edcf158df238",
      donId: "0x66756e2d617262697472756d2d6d61696e6e65742d3100000000000000000000",
      gasLimit: 300000
    },
    
    arbitrumSepolia: {
      url: ARBITRUM_SEPOLIA_RPC_URL,
      chainId: 421614,
      accounts: [DEPLOYER_PRIVATE_KEY, LP_PROVIDER_PRIVATE_KEY, FEE_RECEIVER_PRIVATE_KEY],
      gasPrice: "auto",
      gas: "auto",

      router: "0x234a5fb5Bd614a7AA2FfAB244D603abFA0Ac5C5C",
      donId: "0x66756e2d617262697472756d2d7365706f6c69612d3100000000000000000000",
      gasLimit: 300000
    },
    
    // Ethereum Networks
    mainnet: {
      url: MAINNET_RPC_URL,
      chainId: 1,
      accounts: [DEPLOYER_PRIVATE_KEY, LP_PROVIDER_PRIVATE_KEY, FEE_RECEIVER_PRIVATE_KEY],
      gasPrice: "auto",
      gas: "auto",

      router: "0x65Dcc24F8ff9e51F10DCc7Ed1e4e2A61e6E14bd6",
      donId: "0x66756e2d657468657265756d2d6d61696e6e65742d3100000000000000000000",
      gasLimit: 300000
    },
    
    sepolia: {
      url: SEPOLIA_RPC_URL,
      chainId: 11155111,
      accounts: [DEPLOYER_PRIVATE_KEY, LP_PROVIDER_PRIVATE_KEY, FEE_RECEIVER_PRIVATE_KEY],
      gasPrice: "auto",
      gas: "auto",

      router: "0xb83E47C2bC239B3bf370bc41e1459A34b41238D0",
      donId: "0x66756e2d657468657265756d2d7365706f6c69612d3100000000000000000000",
      gasLimit: 300000
    },
    
  },
  
  etherscan: {
    apiKey: {
      // Ethereum
      mainnet: ETHERSCAN_API_KEY,
      sepolia: ETHERSCAN_API_KEY,
      
      // Arbitrum
      arbitrumOne: ARBISCAN_API_KEY,
      arbitrumSepolia: ARBISCAN_API_KEY,
    },
    
    gasReporter: {
      enabled: process.env.REPORT_GAS === "true",
      currency: "USD",
      gasPrice: 21,
      coinmarketcap: process.env.COINMARKETCAP_API_KEY,
    },
    
    paths: {
      sources: "./contracts",
      tests: "./test",
      cache: "./cache",
      artifacts: "./artifacts",
      scripts: "./scripts",
    },
    
    mocha: {
      timeout: 300000, // 5 minutes - useful for forking tests
    },
  },
};
