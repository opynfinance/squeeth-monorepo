/* eslint-disable prefer-const */
import {
  Collect,
  DecreaseLiquidity,
  IncreaseLiquidity,
  NonfungiblePositionManager,
} from "../../generated/NonfungiblePositionManager/NonfungiblePositionManager";
import { TOKEN_DECIMALS_18 } from "../constants";
import {
  createTransactionHistory,
  buyOrSellLPSQTH,
  buyOrSellLPETH,
} from "../util";
import { convertTokenToDecimal } from "../utils";
import { Address, BigInt } from "@graphprotocol/graph-ts";
import { OSQTH_TOKEN_ADDR, WETH_TOKEN_ADDR } from "../addresses";
import { loadOrCreateLPPosition } from "../utils/loadInit";

function updateLPposition(
  userAddr: string,
  eventAmount0: BigInt,
  eventAmount1: BigInt
): void {
  const amount0 = convertTokenToDecimal(eventAmount0, TOKEN_DECIMALS_18);
  const amount1 = convertTokenToDecimal(eventAmount1, TOKEN_DECIMALS_18);

  buyOrSellLPSQTH(userAddr, amount0);
  buyOrSellLPETH(userAddr, amount1);
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

  const amount0 = convertTokenToDecimal(
    event.params.amount0,
    TOKEN_DECIMALS_18
  );
  const amount1 = convertTokenToDecimal(
    event.params.amount1,
    TOKEN_DECIMALS_18
  );

  const transactionHistory = createTransactionHistory("ADD_LIQUIDITY", event);
  transactionHistory.oSqthAmount = amount0;
  transactionHistory.ethAmount = amount1;
  transactionHistory.save();

  const userAddr = event.transaction.from.toHex();
  updateLPposition(userAddr, event.params.amount0, event.params.amount1);
}

// buying to remove lp
export function handleDecreaseLiquidity(event: DecreaseLiquidity): void {
  const isOSQTHNETHPool = isOSQTHETHPool(event.address, event.params.tokenId);
  if (!isOSQTHNETHPool) return;
  const transactionHistory = createTransactionHistory(
    "REMOVE_LIQUIDITY",
    event
  );
  const amount0 = convertTokenToDecimal(
    event.params.amount0,
    TOKEN_DECIMALS_18
  );

  const amount1 = convertTokenToDecimal(
    event.params.amount1,
    TOKEN_DECIMALS_18
  );

  transactionHistory.oSqthAmount = amount0;
  transactionHistory.ethAmount = amount1;
  transactionHistory.save();

  let userAddr = event.transaction.from.toHex();
  updateLPposition(
    userAddr,
    event.params.amount0.neg(),
    event.params.amount1.neg()
  );
}

export function handleCollect(event: Collect): void {
  const isOSQTHNETHPool = isOSQTHETHPool(event.address, event.params.tokenId);
  if (!isOSQTHNETHPool) return;

  const amount0 = convertTokenToDecimal(
    event.params.amount0,
    TOKEN_DECIMALS_18
  );

  const amount1 = convertTokenToDecimal(
    event.params.amount1,
    TOKEN_DECIMALS_18
  );

  const transactionHistory = createTransactionHistory("COLLECT_FEE", event);
  transactionHistory.oSqthAmount = amount0;
  transactionHistory.ethAmount = amount1;
  transactionHistory.save();

  let userAddr = event.transaction.from.toHex();
  let position = loadOrCreateLPPosition(userAddr);
  position.collectedFeesOSQTHAmount = amount0;
  position.collectedFeesETHAmount = amount1;
  position.save();

  updateLPposition(
    userAddr,
    event.params.amount0.neg(),
    event.params.amount1.neg()
  );
}
