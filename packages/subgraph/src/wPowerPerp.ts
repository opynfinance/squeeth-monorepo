import { Transfer } from "../generated/WPowerPerp/WPowerPerp";
import { createTransactionHistory } from "./util";

export function handleTransfer(event: Transfer): void {
  const senderTransactionHistory = createTransactionHistory(
    "SEND_OSQTH",
    event
  );
  senderTransactionHistory.owner = event.params.from.toHex();
  senderTransactionHistory.oSqthAmount = event.params.value;
  senderTransactionHistory.save();

  const receiverTransactionHistory = createTransactionHistory(
    "RECEIVE_OSQTH",
    event
  );
  receiverTransactionHistory.owner = event.params.to.toHex();
  receiverTransactionHistory.oSqthAmount = event.params.value;
  receiverTransactionHistory.save();
}
