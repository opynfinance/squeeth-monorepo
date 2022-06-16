import { Address, BigDecimal } from "@graphprotocol/graph-ts";
import { Pool } from "../generated/schema";
import { Transfer } from "../generated/WPowerPerp/WPowerPerp";
import { buyOrSellSQTH, createTransactionHistory } from "./util";

export function handleTransfer(event: Transfer): void {
  let pool = Pool.load(event.address.toHexString());

  // If it's from pool, it means buying/selling and shouldn't handle PnL and history logic
  if (pool != null) {
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
    buyOrSellSQTH(receipt.toHexString(), amount);
  }

  buyOrSellSQTH(event.transaction.from.toHex(), amount.neg());
}
