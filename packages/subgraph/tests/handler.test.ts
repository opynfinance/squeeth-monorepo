import { BigDecimal } from "@graphprotocol/graph-ts";
import { assert, clearStore, test, describe, beforeEach } from "matchstick-as";
import { handleOSQTHChange } from "../src/utils/handler";
import { loadOrCreatePosition } from "../src/utils/loadInit";

let userAddr = "0x02a248876233fd78b97ecf1e18114b8eb22ba603";

describe("handleOSQTHChange", () => {
  beforeEach(() => {
    clearStore();
  });

  test("opens long (5 sqth, sqthPrice: $10)", () => {
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
    assert.fieldEquals("Position", position.id, "realizedOSQTHUnitCost", "10");
  });

  test("opens long (5 sqth, sqthPrice: $10) and partically close long (3 sqth, sqthPrice: $12)", () => {
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
    assert.fieldEquals("Position", position.id, "realizedOSQTHUnitGain", "12");
    assert.fieldEquals("Position", position.id, "realizedOSQTHAmount", "3");
  });

  test("opens long (5 sqth, sqthPrice: $10) and buy more sqth (2 sqth, sqthPrice: $8)", () => {
    let position = loadOrCreatePosition(userAddr);

    handleOSQTHChange(
      userAddr,
      BigDecimal.fromString("5"),
      BigDecimal.fromString("10")
    );

    handleOSQTHChange(
      userAddr,
      BigDecimal.fromString("2"),
      BigDecimal.fromString("9")
    );

    assert.fieldEquals("Position", position.id, "currentOSQTHAmount", "7");
    assert.fieldEquals(
      "Position",
      position.id,
      "unrealizedOSQTHUnitCost",
      "9.714285714285714285714285714285714" // 68/7
    );
    assert.fieldEquals(
      "Position",
      position.id,
      "realizedOSQTHUnitCost",
      "9.714285714285714285714285714285714" // 68/7
    );
  });

  test("opens long (5 sqth, sqthPrice: $10), partically close long (3 sqth, sqthPrice: $12), and fully close (2 sqth, sqthPrice: $9)", () => {
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

    handleOSQTHChange(
      userAddr,
      BigDecimal.fromString("-2"),
      BigDecimal.fromString("9")
    );

    assert.fieldEquals("Position", position.id, "currentOSQTHAmount", "0");
    assert.fieldEquals("Position", position.id, "unrealizedOSQTHUnitCost", "0");
    assert.fieldEquals("Position", position.id, "realizedOSQTHUnitGain", "0");
    assert.fieldEquals("Position", position.id, "realizedOSQTHAmount", "0");
  });

  test("opens short (5 sqth, sqthPrice: $10)", () => {
    let position = loadOrCreatePosition(userAddr);

    handleOSQTHChange(
      userAddr,
      BigDecimal.fromString("-5"),
      BigDecimal.fromString("10")
    );

    assert.fieldEquals("Position", position.id, "currentOSQTHAmount", "-5");
    assert.fieldEquals(
      "Position",
      position.id,
      "unrealizedOSQTHUnitCost",
      "10"
    );
    assert.fieldEquals("Position", position.id, "realizedOSQTHUnitCost", "10");
  });

  test("opens short (5 sqth, sqthPrice: $10) and partially close short (2 sqth, $8)", () => {
    let position = loadOrCreatePosition(userAddr);

    handleOSQTHChange(
      userAddr,
      BigDecimal.fromString("-5"),
      BigDecimal.fromString("10")
    );

    handleOSQTHChange(
      userAddr,
      BigDecimal.fromString("2"),
      BigDecimal.fromString("8")
    );

    assert.fieldEquals("Position", position.id, "currentOSQTHAmount", "-3");
    assert.fieldEquals(
      "Position",
      position.id,
      "unrealizedOSQTHUnitCost",
      "11.33333333333333333333333333333333"
    ); // -34/-3
    assert.fieldEquals("Position", position.id, "realizedOSQTHUnitGain", "8");
    assert.fieldEquals("Position", position.id, "realizedOSQTHAmount", "2");
  });

  test("opens short (5 sqth, sqthPrice: $10), partially close short (2 sqth, $8), and partially close short (1 sqth, $12)", () => {
    let position = loadOrCreatePosition(userAddr);

    handleOSQTHChange(
      userAddr,
      BigDecimal.fromString("-5"),
      BigDecimal.fromString("10")
    );

    handleOSQTHChange(
      userAddr,
      BigDecimal.fromString("2"),
      BigDecimal.fromString("8")
    );

    handleOSQTHChange(
      userAddr,
      BigDecimal.fromString("1"),
      BigDecimal.fromString("12")
    );

    assert.fieldEquals("Position", position.id, "currentOSQTHAmount", "-2");
    assert.fieldEquals(
      "Position",
      position.id,
      "unrealizedOSQTHUnitCost",
      "11"
    ); // -22/-2
    assert.fieldEquals(
      "Position",
      position.id,
      "realizedOSQTHUnitGain",
      "-9.333333333333333333333333333333333"
    ); // 28/3
    assert.fieldEquals("Position", position.id, "realizedOSQTHAmount", "3");
  });
});
