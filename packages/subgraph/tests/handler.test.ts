import { BigDecimal } from "@graphprotocol/graph-ts";
import { assert, clearStore, test, describe, beforeEach } from "matchstick-as";
import {
  handleETHChange,
  handleLPETHChange,
  handleLPOSQTHChange,
  handleOSQTHChange,
} from "../src/utils/handler";
import {
  loadOrCreateLPPosition,
  loadOrCreatePosition,
} from "../src/utils/loadInit";

let userAddr = "0x02a248876233fd78b97ecf1e18114b8eb22ba603";

beforeEach(() => {
  clearStore();
});

describe("handleOSQTHChange", () => {
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

  test("opens short (5 sqth, sqthPrice: $10) and partially close short (3 sqth, $8)", () => {
    let position = loadOrCreatePosition(userAddr);

    handleOSQTHChange(
      userAddr,
      BigDecimal.fromString("-5"),
      BigDecimal.fromString("10")
    );

    handleOSQTHChange(
      userAddr,
      BigDecimal.fromString("3"),
      BigDecimal.fromString("8")
    );

    assert.fieldEquals("Position", position.id, "currentOSQTHAmount", "-2");
    assert.fieldEquals(
      "Position",
      position.id,
      "unrealizedOSQTHUnitCost",
      "13"
    ); // -26/-2
    assert.fieldEquals("Position", position.id, "realizedOSQTHUnitGain", "8");
    assert.fieldEquals("Position", position.id, "realizedOSQTHAmount", "3");
  });

  test("opens short (5 sqth, sqthPrice: $10), partially close short (3 sqth, $8), and open more short (2 sqth, $12)", () => {
    let position = loadOrCreatePosition(userAddr);

    handleOSQTHChange(
      userAddr,
      BigDecimal.fromString("-5"),
      BigDecimal.fromString("10")
    );

    handleOSQTHChange(
      userAddr,
      BigDecimal.fromString("3"),
      BigDecimal.fromString("8")
    );

    handleOSQTHChange(
      userAddr,
      BigDecimal.fromString("-2"),
      BigDecimal.fromString("12")
    );

    assert.fieldEquals("Position", position.id, "currentOSQTHAmount", "-4");
    assert.fieldEquals(
      "Position",
      position.id,
      "unrealizedOSQTHUnitCost",
      "12.5"
    );
    assert.fieldEquals(
      "Position",
      position.id,
      "realizedOSQTHUnitCost",
      "10.57142857142857142857142857142857"
    ); // 74/7
    assert.fieldEquals("Position", position.id, "realizedOSQTHUnitGain", "8");
    assert.fieldEquals("Position", position.id, "realizedOSQTHAmount", "3");
  });

  test("opens short (5 sqth, sqthPrice: $10), partially close short (3 sqth, $8), and partially close short (1 sqth, $12)", () => {
    let position = loadOrCreatePosition(userAddr);

    handleOSQTHChange(
      userAddr,
      BigDecimal.fromString("-5"),
      BigDecimal.fromString("10")
    );

    handleOSQTHChange(
      userAddr,
      BigDecimal.fromString("3"),
      BigDecimal.fromString("8")
    );

    handleOSQTHChange(
      userAddr,
      BigDecimal.fromString("1"),
      BigDecimal.fromString("12")
    );

    assert.fieldEquals("Position", position.id, "currentOSQTHAmount", "-1");
    assert.fieldEquals(
      "Position",
      position.id,
      "unrealizedOSQTHUnitCost",
      "14"
    );
    assert.fieldEquals("Position", position.id, "realizedOSQTHUnitCost", "10");
    assert.fieldEquals("Position", position.id, "realizedOSQTHUnitGain", "9");
    assert.fieldEquals("Position", position.id, "realizedOSQTHAmount", "4");
  });

  test("opens short (5 sqth, sqthPrice: $10), partially close short (3 sqth, $8), and fully close short (2 sqth, $12)", () => {
    let position = loadOrCreatePosition(userAddr);

    handleOSQTHChange(
      userAddr,
      BigDecimal.fromString("-5"),
      BigDecimal.fromString("10")
    );

    handleOSQTHChange(
      userAddr,
      BigDecimal.fromString("3"),
      BigDecimal.fromString("8")
    );

    handleOSQTHChange(
      userAddr,
      BigDecimal.fromString("2"),
      BigDecimal.fromString("12")
    );

    assert.fieldEquals("Position", position.id, "currentOSQTHAmount", "0");
    assert.fieldEquals("Position", position.id, "unrealizedOSQTHUnitCost", "0");
    assert.fieldEquals("Position", position.id, "realizedOSQTHUnitCost", "0");
    assert.fieldEquals("Position", position.id, "realizedOSQTHUnitGain", "0");
    assert.fieldEquals("Position", position.id, "realizedOSQTHAmount", "0");
  });
});

describe("handleETHChange", () => {
  test("deposits 5 eth (eqthPrice: $10)", () => {
    let position = loadOrCreatePosition(userAddr);

    handleETHChange(
      userAddr,
      BigDecimal.fromString("5"),
      BigDecimal.fromString("10")
    );

    assert.fieldEquals("Position", position.id, "currentETHAmount", "5");
    assert.fieldEquals("Position", position.id, "unrealizedETHUnitCost", "10");
    assert.fieldEquals("Position", position.id, "realizedETHUnitCost", "10");
  });

  test("deposits 5 eth (eqthPrice: $10) and withdraw 3 eth (ethPrice: $12)", () => {
    let position = loadOrCreatePosition(userAddr);

    handleETHChange(
      userAddr,
      BigDecimal.fromString("5"),
      BigDecimal.fromString("10")
    );

    handleETHChange(
      userAddr,
      BigDecimal.fromString("-3"),
      BigDecimal.fromString("12")
    );

    assert.fieldEquals("Position", position.id, "currentETHAmount", "2");
    assert.fieldEquals("Position", position.id, "unrealizedETHUnitCost", "7");
    assert.fieldEquals("Position", position.id, "realizedETHUnitGain", "12");
    assert.fieldEquals("Position", position.id, "realizedETHAmount", "3");
  });

  test("deposits 5 eth (eqthPrice: $10), withdraw 3 eth (ethPrice: $12), and withdraw all remaining 2 eth (etchPrice: $8)", () => {
    let position = loadOrCreatePosition(userAddr);

    handleETHChange(
      userAddr,
      BigDecimal.fromString("5"),
      BigDecimal.fromString("10")
    );

    handleETHChange(
      userAddr,
      BigDecimal.fromString("-3"),
      BigDecimal.fromString("12")
    );

    handleETHChange(
      userAddr,
      BigDecimal.fromString("-2"),
      BigDecimal.fromString("8")
    );

    assert.fieldEquals("Position", position.id, "currentETHAmount", "0");
    assert.fieldEquals("Position", position.id, "unrealizedETHUnitCost", "0");
    assert.fieldEquals("Position", position.id, "realizedETHUnitGain", "0");
    assert.fieldEquals("Position", position.id, "realizedETHAmount", "0");
  });
});

describe("handleLPSQTHChange", () => {
  test("add liquidity (5 sqth, sqthPrice: $10)", () => {
    let position = loadOrCreateLPPosition(userAddr);

    handleLPOSQTHChange(
      userAddr,
      BigDecimal.fromString("5"),
      BigDecimal.fromString("10")
    );

    assert.fieldEquals("LPPosition", position.id, "currentOSQTHAmount", "5");
    assert.fieldEquals(
      "LPPosition",
      position.id,
      "unrealizedOSQTHUnitCost",
      "10"
    );
    assert.fieldEquals(
      "LPPosition",
      position.id,
      "realizedOSQTHUnitCost",
      "10"
    );
  });

  test("add liquidity (5 sqth, sqthPrice: $10) and remove liquidity (3 sqth, sqthPrice: $12)", () => {
    let position = loadOrCreateLPPosition(userAddr);

    handleLPOSQTHChange(
      userAddr,
      BigDecimal.fromString("5"),
      BigDecimal.fromString("10")
    );

    handleLPOSQTHChange(
      userAddr,
      BigDecimal.fromString("-3"),
      BigDecimal.fromString("12")
    );

    assert.fieldEquals("LPPosition", position.id, "currentOSQTHAmount", "2");
    assert.fieldEquals(
      "LPPosition",
      position.id,
      "unrealizedOSQTHUnitCost",
      "7"
    );
    assert.fieldEquals(
      "LPPosition",
      position.id,
      "realizedOSQTHUnitGain",
      "12"
    );
    assert.fieldEquals("LPPosition", position.id, "realizedOSQTHAmount", "3");
  });
});

describe("handleLPETHChange", () => {
  test("add liquidity (5 eth, ethPrice: $10)", () => {
    let position = loadOrCreateLPPosition(userAddr);

    handleLPETHChange(
      userAddr,
      BigDecimal.fromString("5"),
      BigDecimal.fromString("10")
    );

    assert.fieldEquals("LPPosition", position.id, "currentETHAmount", "5");
    assert.fieldEquals(
      "LPPosition",
      position.id,
      "unrealizedETHUnitCost",
      "10"
    );
    assert.fieldEquals("LPPosition", position.id, "realizedETHUnitCost", "10");
  });

  test("add liquidity (5 eth, ethPrice: $10) and remove liquidity (3 eth, ethPrice: $12)", () => {
    let position = loadOrCreateLPPosition(userAddr);

    handleLPETHChange(
      userAddr,
      BigDecimal.fromString("5"),
      BigDecimal.fromString("10")
    );

    handleLPETHChange(
      userAddr,
      BigDecimal.fromString("-3"),
      BigDecimal.fromString("12")
    );

    assert.fieldEquals("LPPosition", position.id, "currentETHAmount", "2");
    assert.fieldEquals("LPPosition", position.id, "unrealizedETHUnitCost", "7");
    assert.fieldEquals("LPPosition", position.id, "realizedETHUnitGain", "12");
    assert.fieldEquals("LPPosition", position.id, "realizedETHAmount", "3");
  });
});
