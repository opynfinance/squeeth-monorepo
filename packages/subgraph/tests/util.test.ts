import { BigDecimal } from "@graphprotocol/graph-ts";
import { assert, clearStore, test } from "matchstick-as";
import { ZERO_BD } from "../src/constants";
import { buyOrSellSQTH, loadOrCreatePosition } from "../src/util";

// function mockOSQTHPrice(osqthPriceInUSD: string): BigDecimal[] {
//   return [
//     ZERO_BD,
//     ZERO_BD,
//     ZERO_BD,
//     BigDecimal.fromString(osqthPriceInUSD), // oSQTH price in USD
//   ];
// }

test("handleOSQTHChange handles long position properly", () => {
  // let userAddr = "0x02a248876233fd78b97ecf1e18114b8eb22ba603";
  // Open long position with 5 sqth (osqthPriceInUSD: $1000)
  // let position = loadOrCreatePosition(userAddr);
  // handleOSQTHChange(userAddr, BigDecimal.fromString("5"), mockOSQTHPrice("1000"));
  // assert.fieldEquals("Position", position.id, "currentOSQTHAmount", "5");
  // clearStore();
});
