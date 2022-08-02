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
  if (event.params.to === CONTROLLER_ADDR) {
    return;
  }

  let amount = convertTokenToDecimal(event.params.value, TOKEN_DECIMALS_18);

  let senderHistory = createTransactionHistory("SEND_OSQTH", event);
  senderHistory.owner = event.params.from;
  senderHistory.sqthAmount = amount;
  senderHistory.transactionFrom = event.params.from.toHex();
  senderHistory.transactionTo = event.params.to;
  senderHistory.save();

  let recipientHistory = createTransactionHistory("RECEIVE_OSQTH", event);
  recipientHistory.owner = event.params.to;
  recipientHistory.sqthAmount = amount;
  senderHistory.transactionFrom = event.params.from.toHex();
  senderHistory.transactionTo = event.params.to;
  recipientHistory.save();

  sqthChange(event.params.to.toHex(), amount);
  sqthChange(event.params.from.toHex(), amount.neg());
}
