import { Transfer } from "../generated/WPowerPerp/WPowerPerp";
import { saveTransactionHistory } from "./util";

export function handleTransfer(event: Transfer) {
  saveTransactionHistory(event, (transactionHistory) => {
    transactionHistory.transactionType = "TRANSFER_OSQTH";
    transactionHistory.owner = event.params.from.toString();
    transactionHistory.oSqthAmount = event.params.value.neg();
  });

  saveTransactionHistory(event, (transactionHistory) => {
    transactionHistory.transactionType = "TRANSFER_OSQTH";
    transactionHistory.owner = event.params.to.toString();
    transactionHistory.oSqthAmount = event.params.value;
  });
}
