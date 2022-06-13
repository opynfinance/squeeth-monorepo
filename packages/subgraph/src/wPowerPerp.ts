import { BigDecimal } from "@graphprotocol/graph-ts";
import { Transfer } from "../generated/WPowerPerp/WPowerPerp";
import {
  createTransactionHistory,
  getETHUSDCPrice,
  getoSQTHETHPrice,
  loadOrCreatePosition,
} from "./util";

export function handleTransfer(event: Transfer): void {
  let senderTransactionHistory = createTransactionHistory("SEND_OSQTH", event);
  senderTransactionHistory.owner = event.params.from.toHex();
  senderTransactionHistory.oSqthAmount = event.params.value;
  senderTransactionHistory.save();

  let receiverTransactionHistory = createTransactionHistory(
    "RECEIVE_OSQTH",
    event
  );
  receiverTransactionHistory.owner = event.params.to.toHex();
  receiverTransactionHistory.oSqthAmount = event.params.value;
  receiverTransactionHistory.save();

  let osqthPrices = getoSQTHETHPrice();
  let usdcPrices = getETHUSDCPrice();
  let amount = BigDecimal.fromString(event.params.value.toString());

  let senderPosition = loadOrCreatePosition("SHORT", event.params.from.toHex());
  senderPosition.osqthBalance = senderPosition.osqthBalance.minus(amount);
  senderPosition.realizedOSQTHUnitGain = senderPosition.realizedOSQTHUnitGain
    .times(senderPosition.realizedOSQTHAmount)
    .plus(amount.times(osqthPrices[1]).times(usdcPrices[1]))
    .div(senderPosition.realizedETHAmount.plus(amount));
  senderPosition.realizedOSQTHAmount =
    senderPosition.realizedOSQTHAmount.plus(amount);
  senderPosition.save();

  let receiverPosition = loadOrCreatePosition("LONG", event.params.to.toHex());
  receiverPosition.osqthBalance = receiverPosition.osqthBalance.plus(amount);
  receiverPosition.unrealizedOSQTHCost =
    receiverPosition.unrealizedOSQTHCost.plus(
      amount.times(osqthPrices[1]).times(usdcPrices[1])
    );
  receiverPosition.save();
}
