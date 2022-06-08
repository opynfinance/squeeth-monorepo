import { assert, clearStore, log, logStore, test } from "matchstick-as";
import {
  handleBurnShort,
  handleDepositCollateral,
  handleMintShort,
  handleOpenVault,
  handleWithdrawCollateral,
} from "../src/controller";
import { handleTransfer } from "../src/wPowerPerp";
import {
  createBurnShort,
  createDepositCollateral,
  createMintShort,
  createOpenVault,
  createTransfer,
  createWithdrawCollateral,
} from "./utils";

test("MintShort creates transaction history", () => {
  let sender = "0x02a248876233fd78b97ecf1e18114b8eb22ba603";
  let vaultId = "91";
  let amount = "150";

  let openVault = createOpenVault(vaultId);
  handleOpenVault(openVault);

  let mintShort = createMintShort(sender, vaultId, amount);
  handleMintShort(mintShort);

  const id = `${mintShort.transaction.hash.toHex()}-MINT_OSQTH`;

  assert.fieldEquals("TransactionHistory", id, "transactionType", "MINT_OSQTH");
  assert.fieldEquals(
    "TransactionHistory",
    id,
    "owner",
    openVault.transaction.from.toHex()
  );
  assert.fieldEquals("TransactionHistory", id, "oSqthAmount", amount);

  clearStore();
});

test("BurnShort creates transaction history", () => {
  let sender = "0x02a248876233fd78b97ecf1e18114b8eb22ba603";
  let vaultId = "91";
  let amount = "150";

  let openVault = createOpenVault(vaultId);
  handleOpenVault(openVault);

  let burnShort = createBurnShort(sender, vaultId, amount);
  handleBurnShort(burnShort);

  const id = `${burnShort.transaction.hash.toHex()}-BURN_OSQTH`;

  assert.fieldEquals("TransactionHistory", id, "transactionType", "BURN_OSQTH");
  assert.fieldEquals(
    "TransactionHistory",
    id,
    "owner",
    openVault.transaction.from.toHex()
  );
  assert.fieldEquals("TransactionHistory", id, "oSqthAmount", amount);

  clearStore();
});

test("DepositCollateral creates transaction history", () => {
  let sender = "0x02a248876233fd78b97ecf1e18114b8eb22ba603";
  let vaultId = "91";
  let amount = "150";

  let openVault = createOpenVault(vaultId);
  handleOpenVault(openVault);

  let depositCollateral = createDepositCollateral(sender, vaultId, amount);
  handleDepositCollateral(depositCollateral);

  const id = `${depositCollateral.transaction.hash.toHex()}-DEPOSIT_COLLAT`;

  assert.fieldEquals(
    "TransactionHistory",
    id,
    "transactionType",
    "DEPOSIT_COLLAT"
  );
  assert.fieldEquals(
    "TransactionHistory",
    id,
    "owner",
    openVault.transaction.from.toHex()
  );
  assert.fieldEquals("TransactionHistory", id, "ethAmount", amount);

  clearStore();
});

test("WithdrawCollateral creates transaction history", () => {
  let sender = "0x02a248876233fd78b97ecf1e18114b8eb22ba603";
  let vaultId = "91";
  let amount = "150";

  let openVault = createOpenVault(vaultId);
  handleOpenVault(openVault);

  let withdrawCollateral = createWithdrawCollateral(sender, vaultId, amount);
  handleWithdrawCollateral(withdrawCollateral);

  const id = `${withdrawCollateral.transaction.hash.toHex()}-WITHDRAW_COLLAT`;

  assert.fieldEquals(
    "TransactionHistory",
    id,
    "transactionType",
    "WITHDRAW_COLLAT"
  );
  assert.fieldEquals(
    "TransactionHistory",
    id,
    "owner",
    openVault.transaction.from.toHex()
  );
  assert.fieldEquals("TransactionHistory", id, "ethAmount", amount);

  clearStore();
});

test("Transfer wPowerPerp creates transaction histories for sender and receiver", () => {
  let from = "0x02a248876233fd78b97ecf1e18114b8eb22ba603";
  let to = "0x123248876233fd78b97ecf1e18114b8eb22ba603";
  let value = "350";

  let transfer = createTransfer(from, to, value);
  handleTransfer(transfer);

  const senderHistoryId = `${transfer.transaction.hash.toHex()}-SEND_OSQTH`;
  assert.fieldEquals(
    "TransactionHistory",
    senderHistoryId,
    "transactionType",
    "SEND_OSQTH"
  );
  assert.fieldEquals("TransactionHistory", senderHistoryId, "owner", from);
  assert.fieldEquals(
    "TransactionHistory",
    senderHistoryId,
    "oSqthAmount",
    value
  );

  const receiverHistoryId = `${transfer.transaction.hash.toHex()}-RECEIVE_OSQTH`;
  assert.fieldEquals(
    "TransactionHistory",
    receiverHistoryId,
    "transactionType",
    "RECEIVE_OSQTH"
  );
  assert.fieldEquals("TransactionHistory", receiverHistoryId, "owner", to);
  assert.fieldEquals(
    "TransactionHistory",
    receiverHistoryId,
    "oSqthAmount",
    value
  );

  clearStore();
});
