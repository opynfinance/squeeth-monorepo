import { BigDecimal } from "@graphprotocol/graph-ts";
import { assert, clearStore, test, describe, beforeEach } from "matchstick-as";
import { handleOSQTHChange } from "../src/utils/handler";
import { loadOrCreatePosition } from "../src/utils/loadInit";

describe("handleOSQTHChange", () => {
  beforeEach(() => {
    clearStore();
  });

  test("opens long (5 sqth, sqthPrice: $10)", () => {
    let userAddr = "0x02a248876233fd78b97ecf1e18114b8eb22ba603";
    let position = loadOrCreatePosition(userAddr);

    handleOSQTHChange(
      userAddr,
      BigDecimal.fromString("5"),
      BigDecimal.fromString("10")
    );

    assert.fieldEquals("Position", position.id, "currentOSQTHAmount", "5");
    assert.fieldEquals(
      "Position",
      position.id,
      "unrealizedOSQTHUnitCost",
      "10"
    );
  });

  test("opens long (5 sqth, sqthPrice: $10) and partically close long (2 sqth, sqthPrice: $11)", () => {
    let userAddr = "0x02a248876233fd78b97ecf1e18114b8eb22ba603";
    let position = loadOrCreatePosition(userAddr);

    handleOSQTHChange(
      userAddr,
      BigDecimal.fromString("5"),
      BigDecimal.fromString("10")
    );

    handleOSQTHChange(
      userAddr,
      BigDecimal.fromString("-3"),
      BigDecimal.fromString("12")
    );

    assert.fieldEquals("Position", position.id, "currentOSQTHAmount", "2");
    assert.fieldEquals("Position", position.id, "unrealizedOSQTHUnitCost", "7");
  });
});
