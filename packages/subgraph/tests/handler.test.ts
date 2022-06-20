import { BigDecimal } from "@graphprotocol/graph-ts";
import { assert, clearStore, test } from "matchstick-as";
import { handleOSQTHChange } from "../src/utils/handler";
import { loadOrCreatePosition } from "../src/utils/loadInit";

test("handleOSQTHChange handles long position", () => {
  let userAddr = "0x02a248876233fd78b97ecf1e18114b8eb22ba603";

  // Open long position with 5 sqth (osqthPriceInUSD: $1000)
  let position = loadOrCreatePosition(userAddr);
  handleOSQTHChange(
    userAddr,
    BigDecimal.fromString("5"),
    BigDecimal.fromString("1000")
  );

  assert.fieldEquals("Position", position.id, "currentOSQTHAmount", "5");

  clearStore();
});
