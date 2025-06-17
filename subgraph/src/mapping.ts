import {
  VaultOpened,
  VaultClosed,
  UserWithdrawal,
  PositionCreated,
  PositionClosed,
  FundingSettled,
  MintFeeCollected,
  RedemptionFeeCollected,
  PerpEngineUpdated
} from "../generated/Vault/Vault";
import {
  Vault,
  Position,
  Withdrawal,
  FundingSettlement,
  FeeCollection,
  PerpEngineUpdate,
  ProtocolMetric
} from "../generated/schema";
import { BigInt, Bytes } from "@graphprotocol/graph-ts";

export function handleVaultOpened(event: VaultOpened): void {
  // Create vault ID: trader.toHex() + '-' + positionId.toString()
  let vaultId = event.params.trader
    .toHexString()
    .concat("-")
    .concat(event.params.positionId.toString());

  let vault = new Vault(vaultId);

  // Set properties
  vault.trader = event.params.trader;
  vault.positionId = event.params.positionId;
  vault.assetType = event.params.assetType == 0 ? "TSLA" : "APPL";
  vault.mintedAmount = event.params.mintedAmount;
  vault.bufferCollateral = event.params.bufferCollateral;
  vault.hedgedCollateral = event.params.hedgedCollateral;
  vault.entryPrice = event.params.entryPrice;
  vault.createdAt = event.params.date;
  vault.isActive = true;
  
  vault.save();
  
  // Update protocol metrics
  updateProtocolMetrics(
    vault.assetType,
    event.params.bufferCollateral,
    event.params.mintedAmount,
    true
  );
}

export function handleVaultClosed(event: VaultClosed): void {
  // Create the same vault ID as in open
  let vaultId = event.params.trader
    .toHexString()
    .concat("-")
    .concat(event.params.positionId.toString());

  let vault = Vault.load(vaultId);
  if (vault == null) return;

  // Update vault closure details
  vault.closedAt = event.params.date;
  vault.burnedAmount = event.params.burnedAmount;
  vault.amountRefunded = event.params.amountRefunded;
  vault.redemptionFee = event.params.redemtionFee;
  vault.isActive = false;
  
  vault.save();
  
  // Update protocol metrics
  updateProtocolMetrics(
    vault.assetType,
    event.params.amountRefunded,
    event.params.burnedAmount,
    false
  );
}

export function handleUserWithdrawal(event: UserWithdrawal): void {
  // Create withdrawal ID: tx hash + log index
  let withdrawalId = event.transaction.hash
    .toHexString()
    .concat("-")
    .concat(event.logIndex.toString());

  let withdrawal = new Withdrawal(withdrawalId);
  
  withdrawal.trader = event.params.trader;
  withdrawal.amountUSDC = event.params.amountUSDC;
  withdrawal.assetType = event.params.assetType == 0 ? "TSLA" : "APPL";
  withdrawal.timestamp = event.block.timestamp;
  
  withdrawal.save();
}

export function handlePositionCreated(event: PositionCreated): void {
  // Create position ID: trader + positionId
  const positionId = event.params.trader
    .toHexString()
    .concat('-')
    .concat(event.params.positionId.toString());

  let position = new Position(positionId);
  
  // Set position data
  position.trader = event.params.trader;
  position.mintedAmount = event.params.mintedAmount;
  position.bufferCollateral = event.params.bufferCollateral;
  position.hedgedCollateral = event.params.hedgedCollateral;
  position.entryPrice = event.params.entryPrice;
  position.positionIndex = event.params.positionId;
  position.timestamp = event.params.date;
  position.assetType = event.params.assetType == 0 ? "TSLA" : "APPL";
  position.paidOut = false;
  position.isActive = true;
  
  position.save();
}

export function handlePositionClosed(event: PositionClosed): void {
  // Generate position ID (same as creation)
  const positionId = event.params.trader
    .toHexString()
    .concat('-')
    .concat('0'); // Placeholder as index not available
  
  let position = Position.load(positionId);
  if (!position) return;
  
  // Update position closure details
  position.closedTimestamp = event.params.date;
  position.amountRefunded = event.params.amountRefunded;
  position.redemptionFee = event.params.redemtionFee;
  position.paidOut = true;
  position.isActive = false;
  
  position.save();
}

export function handleFundingSettled(event: FundingSettled): void {
  let settlement = new FundingSettlement(
    event.transaction.hash.toHex() + '-' + event.logIndex.toString()
  );
  
  settlement.asset = event.params.asset == 0 ? "TSLA" : "APPL";
  settlement.delta = BigInt.fromI32(event.params.delta);
  settlement.date = event.params.date;
  
  settlement.save();
}

export function handleMintFeeCollected(event: MintFeeCollected): void {
  handleFeeCollection(
    event.params.user,
    event.params.amountUSDC,
    "MINT",
    event.block.timestamp
  );
}

export function handleRedemptionFeeCollected(event: RedemptionFeeCollected): void {
  handleFeeCollection(
    event.params.user,
    event.params.amountUSDC,
    "REDEMPTION",
    event.block.timestamp
  );
}

function handleFeeCollection(
  user: Bytes,
  amount: BigInt,
  type: string,
  timestamp: BigInt
): void {
  let fee = new FeeCollection(
    user.toHexString() + '-' + timestamp.toString() + '-' + type
  );
  
  fee.user = user;
  fee.amountUSDC = amount;
  fee.type = type;
  fee.timestamp = timestamp;
  
  fee.save();
}

export function handlePerpEngineUpdated(event: PerpEngineUpdated): void {
  let update = new PerpEngineUpdate(
    event.transaction.hash.toHex() + '-' + event.logIndex.toString()
  );
  
  update.newPerp = event.params.newPerp;
  update.timestamp = event.block.timestamp;
  
  update.save();
}

function updateProtocolMetrics(
  asset: string,
  collateral: BigInt,
  debt: BigInt,
  isOpen: boolean
): void {
  let metric = ProtocolMetric.load("global");
  if (!metric) {
    metric = new ProtocolMetric("global");
    metric.totalTSLABuffer = BigInt.zero();
    metric.totalAPPLBuffer = BigInt.zero();
    metric.totalTSLADebt = BigInt.zero();
    metric.totalAPPLDebt = BigInt.zero();
  }

  if (asset == "TSLA") {
    metric.totalTSLABuffer = isOpen
      ? metric.totalTSLABuffer.plus(collateral)
      : metric.totalTSLABuffer.minus(collateral);
      
    metric.totalTSLADebt = isOpen
      ? metric.totalTSLADebt.plus(debt)
      : metric.totalTSLADebt.minus(debt);
  } else {
    metric.totalAPPLBuffer = isOpen
      ? metric.totalAPPLBuffer.plus(collateral)
      : metric.totalAPPLBuffer.minus(collateral);
      
    metric.totalAPPLDebt = isOpen
      ? metric.totalAPPLDebt.plus(debt)
      : metric.totalAPPLDebt.minus(debt);
  }

  metric.save();
}