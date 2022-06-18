import { BigInt } from "@graphprotocol/graph-ts";
import { ethereum } from "@graphprotocol/graph-ts";
import { TransactionHistory } from "../../generated/schema";
// import { getETHUSDCPrice, getoSQTHETHPrice } from "../util";

export function createTransactionHistory(
  transactionType: string,
  event: ethereum.Event
): TransactionHistory {
  let transactionHistory = new TransactionHistory(
    `${event.transaction.hash.toHex()}-${transactionType}`
  );

  // let osqthPrices = getoSQTHETHPrice();
  // let usdcPrices = getETHUSDCPrice();
  transactionHistory.owner = event.transaction.from;
  transactionHistory.timestamp = event.block.timestamp;
  transactionHistory.transactionType = transactionType;
  transactionHistory.oSqthAmount = BigInt.zero();
  transactionHistory.ethAmount = BigInt.zero();
  // transactionHistory.ethUSDCSqrtPrice = BigInt.fromString(
  //   usdcPrices[0].toString()
  // );
  // transactionHistory.ethPriceInUSD = usdcPrices[1];
  // transactionHistory.ethOSQTHSqrtPrice = BigInt.fromString(
  //   osqthPrices[0].toString()
  // );
  // transactionHistory.oSqthPriceInETH = osqthPrices[2];

  return transactionHistory;
}
