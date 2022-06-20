import { Account, LPPosition, Position } from "../../generated/schema";
import { BIGINT_ZERO, ZERO_BD } from "../constants";

export function loadOrCreateAccount(accountId: string): Account {
  let account = Account.load(accountId);
  // if no account, create new entity
  if (account == null) {
    account = new Account(accountId);
    account.vaultCount = BIGINT_ZERO;
    account.accShortAmount = BIGINT_ZERO;
  }
  return account;
}

export function initPosition(userAddr: string, position: Position): Position {
  position.owner = userAddr;

  position.currentOSQTHAmount = ZERO_BD;
  position.currentETHAmount = ZERO_BD;
  position.unrealizedOSQTHUnitCost = ZERO_BD;
  position.unrealizedETHUnitCost = ZERO_BD;

  position.realizedOSQTHUnitCost = ZERO_BD;
  position.realizedETHUnitCost = ZERO_BD;
  position.realizedOSQTHUnitGain = ZERO_BD;
  position.realizedETHUnitGain = ZERO_BD;
  position.realizedOSQTHAmount = ZERO_BD;
  position.realizedETHAmount = ZERO_BD;
  return position;
}

export function initLPPosition(
  userAddr: string,
  lpPosition: LPPosition
): LPPosition {
  lpPosition.owner = userAddr;

  lpPosition.currentOSQTHAmount = ZERO_BD;
  lpPosition.currentETHAmount = ZERO_BD;
  lpPosition.unrealizedOSQTHUnitCost = ZERO_BD;
  lpPosition.unrealizedETHUnitCost = ZERO_BD;

  lpPosition.realizedOSQTHUnitCost = ZERO_BD;
  lpPosition.realizedETHUnitCost = ZERO_BD;
  lpPosition.realizedOSQTHUnitGain = ZERO_BD;
  lpPosition.realizedETHUnitGain = ZERO_BD;
  lpPosition.realizedOSQTHAmount = ZERO_BD;
  lpPosition.realizedETHAmount = ZERO_BD;
  lpPosition.collectedFeesETHAmount = ZERO_BD;
  lpPosition.collectedFeesOSQTHAmount = ZERO_BD;

  return lpPosition;
}

export function loadOrCreateLPPosition(userAddr: string): LPPosition {
  let lpPosition = LPPosition.load(userAddr);
  // if no position, create new entity
  if (lpPosition == null) {
    lpPosition = new LPPosition(userAddr);
    lpPosition = initLPPosition(userAddr, lpPosition);
  }
  return lpPosition;
}

export function loadOrCreatePosition(userAddr: string): Position {
  let position = Position.load(userAddr);
  // if no position, create new entity
  if (position == null) {
    position = new Position(userAddr);
    position = initPosition(userAddr, position);
  }
  return position;
}
