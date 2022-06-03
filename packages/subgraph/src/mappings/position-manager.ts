/* eslint-disable prefer-const */
import {
  Collect,
  DecreaseLiquidity,
  IncreaseLiquidity,
  NonfungiblePositionManager,
  Transfer,
} from "../../generated/NonfungiblePositionManager/NonfungiblePositionManager";
import {
  Position,
  PositionSnapshot,
  Token,
  TransactionHistory,
} from "../../generated/schema";

import { Address, BigInt, ethereum } from "@graphprotocol/graph-ts";

function getPosition(event: ethereum.Event, tokenId: BigInt): Position | null {
  let position = Position.load(tokenId.toString());
}

export function handleIncreaseLiquidity(event: IncreaseLiquidity): void {
  let position = getPosition(event, event.params.tokenId);

  // position was not able to be fetched
  if (position == null) {
    return;
  }

  // temp fix
  if (
    Address.fromString(position.pool).equals(
      Address.fromHexString("0x8fe8d9bb8eeba3ed688069c3d6b556c9ca258248")
    )
  ) {
    return;
  }
  let transactionHistory = new TransactionHistory(
    `${event.transaction.hash.toHex()}-${event.logIndex}`
  );

  transactionHistory.timestamp = event.block.timestamp;
  transactionHistory.oSqthAmount = BigInt.zero();
  transactionHistory.ethAmount = BigInt.zero();
  transactionHistory.oSqthPrice = BigInt.zero();

  transactionHistory.save();
}

export function handleDecreaseLiquidity(event: DecreaseLiquidity): void {
  let position = getPosition(event, event.params.tokenId);

  // position was not able to be fetched
  if (position == null) {
    return;
  }

  // temp fix
  if (
    Address.fromString(position.pool).equals(
      Address.fromHexString("0x8fe8d9bb8eeba3ed688069c3d6b556c9ca258248")
    )
  ) {
    return;
  }

  let transactionHistory = new TransactionHistory(
    `${event.transaction.hash.toHex()}-${event.logIndex}`
  );

  transactionHistory.timestamp = event.block.timestamp;
  transactionHistory.oSqthAmount = BigInt.zero();
  transactionHistory.ethAmount = BigInt.zero();
  transactionHistory.oSqthPrice = BigInt.zero();

  transactionHistory.save();
}

export function handleCollect(event: Collect): void {
  let position = getPosition(event, event.params.tokenId);

  // position was not able to be fetched
  if (position == null) {
    return;
  }

  // temp fix
  if (
    Address.fromString(position.pool).equals(
      Address.fromHexString("0x8fe8d9bb8eeba3ed688069c3d6b556c9ca258248")
    )
  ) {
    return;
  }

  let transactionHistory = new TransactionHistory(
    `${event.transaction.hash.toHex()}-${event.logIndex}`
  );

  transactionHistory.timestamp = event.block.timestamp;
  transactionHistory.oSqthAmount = BigInt.zero();
  transactionHistory.ethAmount = BigInt.zero();
  transactionHistory.oSqthPrice = BigInt.zero();

  transactionHistory.save();
}
