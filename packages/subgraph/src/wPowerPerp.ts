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
    event.params.to == SHORT_HELPER_ADDR ||
    event.params.to == CONTROLLER_ADDR ||
    event.params.to == SWAPROUTER_ADDR ||
    event.params.to == SWAPROUTER2_ADDR ||
    event.params.to == NFT_MANAGER_ADDR ||
    event.params.to == CRAB_STRATEGY_ADDR
  ) {
    return;
  }

  let amount = convertTokenToDecimal(event.params.value, TOKEN_DECIMALS_18);

  let senderTransactionHistory = createTransactionHistory("SEND_OSQTH", event);
  senderTransactionHistory.owner = event.params.from;
  senderTransactionHistory.oSqthAmount = amount;
  senderTransactionHistory.save();

  let receiverTransactionHistory = createTransactionHistory(
    "RECEIVE_OSQTH",
    event
  );

  receiverTransactionHistory.owner = event.params.to;
  receiverTransactionHistory.oSqthAmount = amount;
  receiverTransactionHistory.save();

  buyOrSellSQTH(event.params.to.toHex(), amount);
  buyOrSellSQTH(event.params.from.toHex(), amount.neg());
}
