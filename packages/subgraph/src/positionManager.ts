import { Address, BigInt } from "@graphprotocol/graph-ts";
import {
  Collect,
  DecreaseLiquidity,
  IncreaseLiquidity,
  NonfungiblePositionManager,
} from "../generated/NonfungiblePositionManager/NonfungiblePositionManager";
import { OSQTH_TOKEN_ADDR, WETH_TOKEN_ADDR } from "./addresses";
import { TOKEN_DECIMALS_18 } from "./constants";
import {
  convertTokenToDecimal,
  createTransactionHistory,
  ethChange,
  loadOrCreateAccount,
  sqthChange,
} from "./util";

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

export function handleIncreaseLiquidity(event: IncreaseLiquidity): void {
  let isOSQTHNETHPool = isOSQTHETHPool(event.address, event.params.tokenId);
  if (!isOSQTHNETHPool) return;

  let amount0 = convertTokenToDecimal(event.params.amount0, TOKEN_DECIMALS_18);
  let amount1 = convertTokenToDecimal(event.params.amount1, TOKEN_DECIMALS_18);

  let transactionHistory = createTransactionHistory("ADD_LIQUIDITY", event);
  transactionHistory.sqthAmount = amount0;
  transactionHistory.ethAmount = amount1;
  transactionHistory.save();

  sqthChange(event.transaction.from.toHex(), amount0);
  ethChange(event.transaction.from.toHex(), amount1);
}

export function handleDecreaseLiquidity(event: DecreaseLiquidity): void {
  let isOSQTHNETHPool = isOSQTHETHPool(event.address, event.params.tokenId);
  if (!isOSQTHNETHPool) return;

  let amount0 = convertTokenToDecimal(event.params.amount0, TOKEN_DECIMALS_18);
  let amount1 = convertTokenToDecimal(event.params.amount1, TOKEN_DECIMALS_18);

  let transactionHistory = createTransactionHistory("REMOVE_LIQUIDITY", event);
  transactionHistory.sqthAmount = amount0;
  transactionHistory.ethAmount = amount1;
  transactionHistory.save();

  sqthChange(event.transaction.from.toHex(), amount0.neg());
  ethChange(event.transaction.from.toHex(), amount1.neg());
}

export function handleCollect(event: Collect): void {
  let isOSQTHNETHPool = isOSQTHETHPool(event.address, event.params.tokenId);
  if (!isOSQTHNETHPool) return;

  let amount0 = convertTokenToDecimal(event.params.amount0, TOKEN_DECIMALS_18);
  let amount1 = convertTokenToDecimal(event.params.amount1, TOKEN_DECIMALS_18);

  let transactionHistory = createTransactionHistory("COLLECT_FEE", event);
  transactionHistory.sqthAmount = amount0;
  transactionHistory.ethAmount = amount1;
  transactionHistory.save();

  let account = loadOrCreateAccount(event.transaction.from.toHex());
  account.sqthCollected = account.sqthCollected.plus(amount0);
  account.ethCollected = account.ethCollected.plus(amount1);
  account.save();
}
