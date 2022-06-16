import { Address, BigDecimal } from "@graphprotocol/graph-ts";
import { Transfer } from "../generated/WPowerPerp/WPowerPerp";
import { buyOrSellSQTH, createTransactionHistory } from "./util";

export function handleTransfer(event: Transfer): void {
  let senderTransactionHistory = createTransactionHistory("SEND_OSQTH", event);
  senderTransactionHistory.owner = Address.fromString(
    event.params.from.toHex()
  );
  senderTransactionHistory.oSqthAmount = event.params.value;
  senderTransactionHistory.save();

  let receiverTransactionHistory = createTransactionHistory(
    "RECEIVE_OSQTH",
    event
  );
  receiverTransactionHistory.owner = Address.fromString(
    event.params.to.toHex()
  );
  receiverTransactionHistory.oSqthAmount = event.params.value;
  receiverTransactionHistory.save();

  let amount = BigDecimal.fromString(event.params.value.toString());
  buyOrSellSQTH(event.params.from.toHex(), amount.neg());
  buyOrSellSQTH(event.params.to.toHex(), amount);
}
