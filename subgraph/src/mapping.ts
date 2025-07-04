import {
  VaultOpened,
  VaultClosed,
  UserWithdrawal,
  FundingSettled,
  MintFeeCollected,
  RedemptionFeeCollected,
  PerpEngineUpdated,
} from "../generated/Vault/Vault";

import {
  PositionOpened as PerpPositionOpenedEvent,
  PositionClosed as PerpPositionClosedEvent,
  PositionLiquidated as PerpPositionLiquidatedEvent,
  FundingUpdated as PerpFundingUpdatedEvent,
  CollateralAdded as PerpCollateralAddedEvent,
  CollateralWithdrawn as PerpCollateralWithdrawnEvent,
  VaultHedgeOpened as VaultHedgeOpenedEvent,
  VaultHedgeClosed as VaultHedgeClosedEvent,
} from "../generated/PerpEngine/PerpEngine";

import { MessageReceived as MessageReceivedEvent, MessageFailed as MessageFailedEvent } from "../generated/ReceiverContract/ReceiverContract";

import {
  Vault,
  Withdrawal,
  FundingSettlement,
  FeeCollection,
  PerpEngineUpdate,
  ProtocolMetric,
  PerpPosition,
  PerpFundingUpdate,
  PerpLiquidation,
  VaultHedge,
  CCIPMessage,
  CCIPMessageFailed,
} from "../generated/schema";
import { BigInt, Bytes } from "@graphprotocol/graph-ts";

function getAssetString(assetEnum: number): string {
  if (assetEnum == 0) return "TSLA";
  if (assetEnum == 1) return "APPL";
  return "UNKNOWN";
}

// --- VAULT HANDLERS ---

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
  vault.assetType = getAssetString(event.params.assetType);
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

  if (vault.mintedAmount.gt(BigInt.zero())) {
    let originalDebt = vault.mintedAmount.plus(event.params.burnedAmount);
    let portionOfBuffer = vault.bufferCollateral
      .times(event.params.burnedAmount)
      .div(originalDebt);
    updateProtocolMetrics(
      vault.assetType,
      portionOfBuffer,
      event.params.burnedAmount,
      false
    );
  }
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
  withdrawal.assetType = getAssetString(event.params.assetType);
  withdrawal.timestamp = event.block.timestamp;

  withdrawal.save();
}

export function handleFundingSettled(event: FundingSettled): void {
  let settlement = new FundingSettlement(
    event.transaction.hash.toHex() + "-" + event.logIndex.toString()
  );

  settlement.asset = getAssetString(event.params.asset);
  settlement.delta = event.params.delta;
  settlement.date = event.params.date;

  settlement.save();
}

export function handleMintFeeCollected(event: MintFeeCollected): void {
  handleFeeCollection(
    event.params.user,
    event.params.amountUSDC,
    "MINT",
    event.block.timestamp,
    event.transaction.hash.toHex() + "-" + event.logIndex.toString()
  );
}

export function handleRedemptionFeeCollected(
  event: RedemptionFeeCollected
): void {
  handleFeeCollection(
    event.params.user,
    event.params.amountUSDC,
    "REDEMPTION",
    event.block.timestamp,
    event.transaction.hash.toHex() + "-" + event.logIndex.toString()
  );
}

function handleFeeCollection(
  user: Bytes,
  amount: BigInt,
  type: string,
  timestamp: BigInt,
  id: string
): void {
  let fee = new FeeCollection(id);

  fee.user = user;
  fee.amountUSDC = amount;
  fee.type = type;
  fee.timestamp = timestamp;

  fee.save();
}

export function handlePerpEngineUpdated(event: PerpEngineUpdated): void {
  let update = new PerpEngineUpdate(
    event.transaction.hash.toHex() + "-" + event.logIndex.toString()
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
  } else if (asset == "APPL") {
    metric.totalAPPLBuffer = isOpen
      ? metric.totalAPPLBuffer.plus(collateral)
      : metric.totalAPPLBuffer.minus(collateral);

    metric.totalAPPLDebt = isOpen
      ? metric.totalAPPLDebt.plus(debt)
      : metric.totalAPPLDebt.minus(debt);
  }

  metric.save();
}

// --- PERP ENGINE HANDLERS ---

export function handlePerpPositionOpened(event: PerpPositionOpenedEvent): void {
  let positionId = event.params.trader
    .toHexString()
    .concat("-")
    .concat(getAssetString(event.params.asset));
  let position = new PerpPosition(positionId);

  position.user = event.params.trader;
  position.asset = getAssetString(event.params.asset);
  position.sizeUsd = event.params.sizeUsd;
  position.collateral = event.params.collateralAmount;
  position.entryPrice = event.params.price;
  position.isLong = event.params.isLong;
  position.status = "Open";
  position.openedAt = event.block.timestamp;
  position.lastUpdatedAt = event.block.timestamp;

  position.save();
}

export function handlePerpPositionClosed(event: PerpPositionClosedEvent): void {
  let positionId = event.params.user
    .toHexString()
    .concat("-")
    .concat(getAssetString(event.params.asset));
  let position = PerpPosition.load(positionId);

  if (position) {
    position.status = "Closed";
    position.closedAt = event.block.timestamp;
    position.totalPnl = event.params.pnl;
    position.save();
  }
}

export function handlePerpPositionLiquidated(
  event: PerpPositionLiquidatedEvent
): void {
  let positionId = event.params.user
    .toHexString()
    .concat("-")
    .concat(getAssetString(event.params.asset));
  let position = PerpPosition.load(positionId);

  if (position) {
    position.status = "Liquidated";
    position.closedAt = event.block.timestamp;
    position.save();

    let liquidationId =
      event.transaction.hash.toHex() + "-" + event.logIndex.toString();
    let liquidation = new PerpLiquidation(liquidationId);
    liquidation.position = position.id;
    liquidation.liquidator = event.transaction.from; // The one who sent the tx
    liquidation.user = event.params.user;
    liquidation.penalty = event.params.penalty;
    liquidation.timestamp = event.block.timestamp;
    liquidation.save();
  }
}

export function handlePerpFundingUpdated(event: PerpFundingUpdatedEvent): void {
  let fundingUpdateId =
    event.transaction.hash.toHex() + "-" + event.logIndex.toString();
  let funding = new PerpFundingUpdate(fundingUpdateId);
  funding.asset = getAssetString(event.params.asset);
  funding.hourlyFundingRate = event.params.hourlyFundingRate;
  funding.newCumulativeFundingRate = event.params.newCumulativeFundingRate;
  funding.timestamp = event.block.timestamp;
  funding.save();
}

export function handlePerpCollateralAdded(
  event: PerpCollateralAddedEvent
): void {
  let positionId = event.params.user
    .toHexString()
    .concat("-")
    .concat(getAssetString(event.params.asset));
  let position = PerpPosition.load(positionId);

  if (position) {
    position.collateral = event.params.newCollateral;
    position.lastUpdatedAt = event.block.timestamp;
    position.save();
  }
}

export function handlePerpCollateralWithdrawn(
  event: PerpCollateralWithdrawnEvent
): void {
  let positionId = event.params.user
    .toHexString()
    .concat("-")
    .concat(getAssetString(event.params.asset));
  let position = PerpPosition.load(positionId);

  if (position) {
    position.collateral = event.params.remainingCollateral;
    position.lastUpdatedAt = event.block.timestamp;
    position.save();
  }
}

export function handleVaultHedgeOpened(event: VaultHedgeOpenedEvent): void {
  let hedgeId = getAssetString(event.params.asset);
  let hedge = new VaultHedge(hedgeId);
  hedge.asset = hedgeId;
  hedge.sizeUsd = event.params.amount;
  hedge.collateral = event.params.amount; // 1x hedge
  // Entry price not in event, would need a contract call if required
  hedge.entryPrice = BigInt.zero();
  hedge.lastUpdatedAt = event.block.timestamp;
  hedge.save();
}

export function handleVaultHedgeClosed(event: VaultHedgeClosedEvent): void {
  let hedgeId = getAssetString(event.params.asset);
  let hedge = VaultHedge.load(hedgeId);
  if (hedge) {
    hedge.sizeUsd = hedge.sizeUsd.minus(event.params.amount);
    hedge.collateral = hedge.collateral.minus(event.params.amount);
    hedge.lastUpdatedAt = event.block.timestamp;
    hedge.save();
  }
}

// --- RECEIVER CONTRACT HANDLERS ---

export function handleMessageReceived(event: MessageReceivedEvent): void {
  let messageId = event.params.messageId.toHex();
  let message = new CCIPMessage(messageId);
  message.messageId = event.params.messageId;
  message.sourceChainSelector = event.params.sourceChainSelector;
  message.sender = event.params.sender;
  message.data = event.params.data;
  message.token = event.params.token;
  message.tokenAmount = event.params.tokenAmount;
  message.status = "Received";
  message.timestamp = event.block.timestamp;
  message.save();
}

export function handleMessageFailed(event: MessageFailedEvent): void {
  let id = event.params.messageId.toHex();
  let failed = new CCIPMessageFailed(id);
  failed.messageId = event.params.messageId;
  failed.reason = event.params.reason;
  failed.timestamp = event.block.timestamp;
  failed.save();
}