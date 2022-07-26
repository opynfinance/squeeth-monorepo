import { Transfer } from "../generated/WPowerPerp/WPowerPerp";
import { TOKEN_DECIMALS_18 } from "./constants";
import {
  convertTokenToDecimal,
  createTransactionHistory,
} from "./util";

export function handleTransfer(event: Transfer): void {
  let amount = convertTokenToDecimal(event.params.value, TOKEN_DECIMALS_18);

  let senderHistory = createTransactionHistory("SEND_OSQTH", event);
  senderHistory.owner = event.params.from;
  senderHistory.sqthAmount = amount;
  senderHistory.save();

  let recipientHistory = createTransactionHistory("RECEIVE_OSQTH", event);
  recipientHistory.owner = event.params.to;
  recipientHistory.sqthAmount = amount;
  recipientHistory.save();

  // sqthChange(event.params.to.toHex(), amount);
  // sqthChange(event.params.from.toHex(), amount.neg());
}
