/* eslint-disable prefer-const */
import {
  Collect,
  DecreaseLiquidity,
  IncreaseLiquidity,
  NonfungiblePositionManager,
} from "../../generated/NonfungiblePositionManager/NonfungiblePositionManager";
import { LPPosition, Position, Vault } from "../../generated/schema";
import {
  ONE_BI,
  OSQTH_TOKEN_ADDR,
  TOKEN_DECIMALS_18,
  WETH_TOKEN_ADDR,
  ZERO_BD,
  ZERO_BI,
} from "../constants";
import {
  initLPPosition,
  createTransactionHistory,
  getETHUSDCPrice,
  getoSQTHETHPrice,
  loadOrCreateAccount,
  loadOrCreateLPPosition,
  loadOrCreatePosition,
  buyOrSellSQTH,
  buyOrSellETH,
} from "../util";
import { convertTokenToDecimal } from "../utils";
import { Address, BigInt, log } from "@graphprotocol/graph-ts";

function updateLPposition(
  userAddr: string,
  eventAmount0: BigInt,
  eventAmount1: BigInt
) {
  const amount0 = convertTokenToDecimal(eventAmount0, TOKEN_DECIMALS_18);
  const amount1 = convertTokenToDecimal(eventAmount1, TOKEN_DECIMALS_18);

  buyOrSellSQTH(userAddr, amount0, true);
  buyOrSellETH(userAddr, amount1, true);
}

function isOSQTHETHPool(address: Address, tokenId: BigInt): boolean {
  let contract = NonfungiblePositionManager.bind(address);
  let positionCall = contract.try_positions(tokenId);
  if (!positionCall.reverted) {
    let positionResult = positionCall.value;
    if (
      positionResult.value2.toHexString().toLowerCase() == OSQTH_TOKEN_ADDR &&
      positionResult.value3.toHexString().toLowerCase() == WETH_TOKEN_ADDR
    ) {
      return true;
    }
  }

  return false;
}
// selling to remove lp
export function handleIncreaseLiquidity(event: IncreaseLiquidity): void {
  const isOSQTHNETHPool = isOSQTHETHPool(event.address, event.params.tokenId);
  if (!isOSQTHNETHPool) return;
  const transactionHistory = createTransactionHistory("ADD_LIQUIDITY", event);
  transactionHistory.oSqthAmount = event.params.amount0;
  transactionHistory.ethAmount = event.params.amount1;
  transactionHistory.save();

  const userAddr = event.transaction.from.toHex();
  const account = loadOrCreateAccount(userAddr);

  updateLPposition(userAddr, event.params.amount0, event.params.amount1);

  // const amount0 = convertTokenToDecimal(
  //   event.params.amount0,
  //   TOKEN_DECIMALS_18
  // );
  // const amount1 = convertTokenToDecimal(
  //   event.params.amount1,
  //   TOKEN_DECIMALS_18
  // );

  // // if long & lp
  // const longPosition = Position.load(userAddr);
  // // const longPosition = Vault.load(userAddr);
  // buyOrSellSQTH(userAddr, amount0, false);
  // buyOrSellETH(userAddr, amount1, false);
  account.save();
}

// buying to remove lp
export function handleDecreaseLiquidity(event: DecreaseLiquidity): void {
  const isOSQTHNETHPool = isOSQTHETHPool(event.address, event.params.tokenId);
  if (!isOSQTHNETHPool) return;
  const transactionHistory = createTransactionHistory(
    "REMOVE_LIQUIDITY",
    event
  );
  transactionHistory.oSqthAmount = event.params.amount0;
  transactionHistory.ethAmount = event.params.amount1;
  transactionHistory.save();

  let userAddr = event.transaction.from.toHex();
  updateLPposition(
    userAddr,
    event.params.amount0.times(ZERO_BI.minus(ONE_BI)),
    event.params.amount1.times(ZERO_BI.minus(ONE_BI))
  );
  // const amount0 = convertTokenToDecimal(
  //   event.params.amount0.times(ZERO_BI.minus(ONE_BI)),
  //   TOKEN_DECIMALS_18
  // );

  // const longPosition = Position.load(userAddr);
  // if (longPosition == null) {
  //   return;
  // }
}

export function handleCollect(event: Collect): void {
  const isOSQTHNETHPool = isOSQTHETHPool(event.address, event.params.tokenId);
  if (!isOSQTHNETHPool) return;
  const transactionHistory = createTransactionHistory("COLLECT_FEE", event);
  transactionHistory.oSqthAmount = event.params.amount0;
  transactionHistory.ethAmount = event.params.amount1;
  transactionHistory.save();

  let userAddr = event.transaction.from.toHex();
  const account = loadOrCreateAccount(userAddr);
  updateLPposition(userAddr, event.params.amount0, event.params.amount1);

  account.save();
}
