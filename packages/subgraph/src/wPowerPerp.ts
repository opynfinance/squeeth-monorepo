import { BigDecimal, log } from "@graphprotocol/graph-ts";
import { Pool } from "../generated/schema";
import { Transfer } from "../generated/WPowerPerp/WPowerPerp";
import { CONTROLLER_ADDR, SHORT_HELPER_ADDR } from "./constants";
import { buyOrSellSQTH, createTransactionHistory } from "./util";

export function handleTransfer(event: Transfer): void {
  let pool = Pool.load(event.address.toHexString());
  if (
    pool != null ||
    event.transaction.to == SHORT_HELPER_ADDR ||
    event.transaction.to == CONTROLLER_ADDR
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
  let amount = BigDecimal.fromString(event.params.value.toString());
  let receipt = event.transaction.to;
  if (receipt) {
    receiverTransactionHistory.owner = receipt;
    receiverTransactionHistory.oSqthAmount = event.params.value;
    receiverTransactionHistory.save();
    buyOrSellSQTH(receipt.toHex(), amount);
  }

  buyOrSellSQTH(event.transaction.from.toHex(), amount.neg());
}
