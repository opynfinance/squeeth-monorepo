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
    event.transaction.to ===
    Address.fromString("0x59f0c781a6ec387f09c40faa22b7477a2950d209")
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
