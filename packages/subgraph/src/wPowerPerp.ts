import { Transfer } from "../generated/WPowerPerp/WPowerPerp";
import {
  CONTROLLER_ADDR,
  NFT_MANAGER_ADDR,
  SHORT_HELPER_ADDR,
  SWAPROUTER2_ADDR,
  SWAPROUTER_ADDR,
  CRAB_STRATEGY_ADDR,
} from "./addresses";
import { TOKEN_DECIMALS_18 } from "./constants";
import { buyOrSellSQTH, createTransactionHistory } from "./util";
import { convertTokenToDecimal } from "./utils";

export function handleTransfer(event: Transfer): void {
  if (
    event.transaction.to == SHORT_HELPER_ADDR ||
    event.transaction.to == CONTROLLER_ADDR ||
    event.transaction.to == SWAPROUTER_ADDR ||
    event.transaction.to == SWAPROUTER2_ADDR ||
    event.transaction.to == NFT_MANAGER_ADDR ||
    event.transaction.to == CRAB_STRATEGY_ADDR
  ) {
    return;
  }

  let senderTransactionHistory = createTransactionHistory("SEND_OSQTH", event);
  senderTransactionHistory.owner = event.transaction.from;
  senderTransactionHistory.oSqthAmount = event.params.value;
  senderTransactionHistory.save();

  let receiverTransactionHistory = createTransactionHistory(
    "RECEIVE_OSQTH",
    event
  );

  let amount = convertTokenToDecimal(event.params.value, TOKEN_DECIMALS_18);
  let receipt = event.transaction.to;
  if (receipt) {
    receiverTransactionHistory.owner = receipt;
    receiverTransactionHistory.oSqthAmount = event.params.value;
    receiverTransactionHistory.save();
    buyOrSellSQTH(receipt.toHex(), amount);
  }

  buyOrSellSQTH(event.transaction.from.toHex(), amount.neg());
}
