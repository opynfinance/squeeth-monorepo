import { Address } from "@graphprotocol/graph-ts";
import { Transfer } from "../generated/WPowerPerp/WPowerPerp";
import {
  CONTROLLER_ADDR,
  CRAB_STRATEGY_ADDR,
  NFT_MANAGER_ADDR,
  OSQTH_WETH_POOL,
  SHORT_HELPER_ADDR,
  SWAPROUTER2_ADDR,
  SWAPROUTER_ADDR,
} from "./addresses";
import { TOKEN_DECIMALS_18 } from "./constants";
import {
  convertTokenToDecimal,
  createTransactionHistory,
  sqthChange,
} from "./util";

export function handleTransfer(event: Transfer): void {
  if (
    event.transaction.from === SHORT_HELPER_ADDR ||
    event.transaction.from === SWAPROUTER_ADDR ||
    event.transaction.from === SWAPROUTER2_ADDR ||
    event.transaction.from === CONTROLLER_ADDR ||
    event.transaction.from === CRAB_STRATEGY_ADDR ||
    event.transaction.from === NFT_MANAGER_ADDR ||
    event.transaction.from === Address.fromString(OSQTH_WETH_POOL) ||
    event.transaction.from ===
      Address.fromString("0x0000000000000000000000000000000000000000")
  ) {
    return;
  }

  if (
    event.transaction.to === SHORT_HELPER_ADDR ||
    event.transaction.to === SWAPROUTER_ADDR ||
    event.transaction.to === SWAPROUTER2_ADDR ||
    event.transaction.to === CONTROLLER_ADDR ||
    event.transaction.to === CRAB_STRATEGY_ADDR ||
    event.transaction.to === NFT_MANAGER_ADDR ||
    event.transaction.to === Address.fromString(OSQTH_WETH_POOL) ||
    event.transaction.to ===
      Address.fromString("0x0000000000000000000000000000000000000000")
  ) {
    return;
  }

  let amount = convertTokenToDecimal(event.params.value, TOKEN_DECIMALS_18);

  let senderHistory = createTransactionHistory("SEND_OSQTH", event);
  senderHistory.owner = event.params.from;
  senderHistory.sqthAmount = amount;
  senderHistory.save();

  let recipientHistory = createTransactionHistory("RECEIVE_OSQTH", event);
  recipientHistory.owner = event.params.to;
  recipientHistory.sqthAmount = amount;
  recipientHistory.save();

  sqthChange(event.params.to.toHex(), amount);
  sqthChange(event.params.from.toHex(), amount.neg());
}
