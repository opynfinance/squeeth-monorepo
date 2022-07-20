import { Address, BigInt } from "@graphprotocol/graph-ts";
import {
  Collect,
  DecreaseLiquidity,
  IncreaseLiquidity,
  NonfungiblePositionManager,
} from "../generated/NonfungiblePositionManager/NonfungiblePositionManager";
import { OSQTH_TOKEN_ADDR, WETH_TOKEN_ADDR } from "./addresses";
import { TOKEN_DECIMALS_18 } from "./constants";
import { convertTokenToDecimal, ethChange } from "./util";

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

  ethChange(
    event.transaction.from.toHex(),
    convertTokenToDecimal(event.params.amount1, TOKEN_DECIMALS_18)
  );
}

export function handleDecreaseLiquidity(event: DecreaseLiquidity): void {
  let isOSQTHNETHPool = isOSQTHETHPool(event.address, event.params.tokenId);
  if (!isOSQTHNETHPool) return;

  ethChange(
    event.transaction.from.toHex(),
    convertTokenToDecimal(event.params.amount1, TOKEN_DECIMALS_18).neg()
  );
}

export function handleCollect(event: Collect): void {
  let isOSQTHNETHPool = isOSQTHETHPool(event.address, event.params.tokenId);
  if (!isOSQTHNETHPool) return;

  ethChange(
    event.transaction.from.toHex(),
    convertTokenToDecimal(event.params.amount1, TOKEN_DECIMALS_18).neg()
  );
}
