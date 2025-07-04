// PerpEngine ABI based on the actual contract
export const PERP_ENGINE_ABI = [
  // Core trading functions
  "function openPosition(uint8 asset, uint256 collateralAmount, uint256 sizeUsd, bool isLong) external",
  "function addCollateral(uint8 asset, uint256 addedCollateral) external",
  "function increasePosition(uint8 asset, uint256 addedSizeUsd) external", 
  "function reducePosition(uint8 asset, uint256 reduceSizeUsd) external returns (uint256 netReturn, int256 pnl)",
  "function closePosition(uint8 asset) external",
  "function withdrawCollateral(uint8 asset, uint256 amount) external",
  
  // Liquidation functions
  "function liquidate(address user, uint8 asset) external",
  "function isLiquidatable(address user, uint8 asset) external view returns (bool)",

  "function setPerpEngineZK(address _perpEngineZK) external",
  "function applyNetDelta(uint8 assetId, int256 qtyDelta, int256 marginDelta) external",
  "function liquidateFromZK(address user, uint8 assetId) external",
  "function getPositionForZK(address trader, uint8 asset) external view returns (uint256 sizeUsd, uint256 collateral, uint256 entryPrice, int256 entryFundingRate, bool isLong, uint256 lastBorrowingUpdate, int256 unrealizedPnL)",
  
  // Vault hedge functions
  "function openVaultHedge(uint8 asset, uint256 hedgeAmount) external returns (bytes32 positionId)",
  "function closeVaultHedge(uint8 asset, uint256 redeemAmount) external returns (uint256 actualReturn)",
  "function emergencyCloseVaultHedge(uint8 asset) external returns (uint256 actualReturn)",
  
  // View functions for positions
  "function getPosition(address user, uint8 asset) external view returns (uint256 sizeUsd, uint256 collateral, uint256 entryPrice, int256 entryFundingRate, bool isLong, uint256 lastBorrowingUpdate)",
  "function getVaultHedgePosition(uint8 asset) external view returns (uint256 sizeUsd, uint256 collateral, uint256 entryPrice, int256 currentPnL, uint256 currentValue, bool exists)",
  "function getPnL(uint8 asset, address user) external view returns (int256)",
  "function getCollateralRatio(address user, uint8 asset) external view returns (uint256)",
  "function getLeverage(address user, uint8 asset) external view returns (uint256)",
  "function getLiquidationPrice(address user, uint8 asset) external view returns (uint256)",
  
  // Market data functions
  "function getOpenInterest(uint8 asset) external view returns (uint256 longUsd, uint256 shortUsd)",
  "function getLongOI(uint8 asset) external view returns (uint256)",
  "function getPoolUtilization() external view returns (uint256)",
  "function getFundingRate(uint8 asset) external view returns (int256)",
  
  // Configuration view functions
  "function fundingRateSensitivity() external view returns (uint256)",
  "function minCollateralRatioBps() external view returns (uint256)",
  "function maxUtilizationBps() external view returns (uint256)",
  "function openFeeBps() external view returns (uint256)",
  "function closeFeeBps() external view returns (uint256)",
  "function liquidationFeeBps() external view returns (uint256)",
  "function borrowingRateAnnualBps() external view returns (uint256)",
  "function isPaused() external view returns (bool)",
  
  // Admin functions
  "function setConfig(uint256 sensitivity, uint256 minCR, uint256 maxUtil) external",
  "function setFees(uint256 _open, uint256 _close, uint256 _liq) external",
  "function pause() external",
  "function unpause() external",
  "function setFeeReceiver(address _receiver) external",
  "function addFeesToPool(uint256 feeAmount) external",
  
  // Events
  "event PositionOpened(address trader, uint8 asset, uint256 sizeUsd, uint256 collateralAmount, uint256 price, bool isLong)",
  "event PositionClosed(address indexed user, uint8 asset, uint256 sizeUsd, uint256 netReturn, int256 pnl)",
  "event PositionLiquidated(address indexed user, uint8 asset, uint256 positionSize, uint256 penalty)",
  "event FundingUpdated(uint8 indexed asset, int256 hourlyFundingRate, int256 newCumulativeFundingRate)",
  "event VaultHedgeOpened(address indexed user, uint8 asset, uint256 amount)",
  "event VaultHedgeClosed(address indexed user, uint8 indexed asset, uint256 amount)"
];

// ChainLinkManager ABI for price feeds
export const CHAINLINK_MANAGER_ABI = [
  "function getPrice(uint8 asset) external view returns (uint256)",
  "function getDexPrice(uint8 asset) external view returns (uint256)", 
  "function checkIfAssetIsPaused(uint8 assetType) external view returns (bool)"
];

// LiquidityPool ABI
export const LIQUIDITY_POOL_ABI = [
  "function reserve(uint256 amount) external",
  "function unreserve(uint256 amount) external",
  "function releaseTo(address to, uint256 amount) external",
  "function reserveFrom(address from, uint256 amount) external",
  "function totalLiquidity() external view returns (uint256)",
  "function reservedLiquidity() external view returns (uint256)",
  "function collectFee(uint256 amount) external"
];

// USDC token interface
export const ERC20_ABI = [
  "function transfer(address to, uint256 amount) external returns (bool)",
  "function transferFrom(address from, address to, uint256 amount) external returns (bool)",
  "function balanceOf(address account) external view returns (uint256)",
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function decimals() external view returns (uint8)"
];

// PerpEngineZK ABI for the privacy layer
export const PERP_ENGINE_ZK_ABI = [
  // Batch processing function
  "function processBatch(uint8[] assetIds, bytes32[] oldRoots, bytes32[] newRoots, int256[] netDeltas, int256[] marginDeltas) external",
  
  // ZK liquidation function  
  "function verifyAndLiquidate(uint8 assetId, bytes32 oldRoot, bytes32 newRoot, address trader, int256 size, uint256 margin, uint256 entryFunding, bytes proof) external",
  
  // View functions
  "function getCurrentRoot(uint8 assetId) external view returns (bytes32)",
  "function getAssetInfo(uint8 assetId) external view returns (bytes32 root, uint40 lastUpdate)",
  
  // Admin functions
  "function initializeAsset(uint8 assetId, bytes32 initialRoot) external",
  
  // Events
  "event RootUpdated(uint8 indexed assetId, bytes32 oldRoot, bytes32 newRoot)",
  "event BatchProcessed(uint8[] assetIds, int256[] netDeltas, int256[] marginDeltas)",
  "event LiquidationVerified(address indexed trader, uint8 indexed assetId, int256 size)"
];
