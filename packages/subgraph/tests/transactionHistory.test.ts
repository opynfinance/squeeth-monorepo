import { assert, test } from "matchstick-as";
import { handleBurnShort, handleOpenVault } from "../src/controller";
import { createBurnShort, createOpenVault } from "./eventCreators";

test("BurnShort creates transaction history", () => {
  let sender = "0x02a248876233fd78b97ecf1e18114b8eb22ba603";
  let vaultId = "91";
  let amount = "150";

  let openVault = createOpenVault(vaultId);
  handleOpenVault(openVault);

  let burnShort = createBurnShort(sender, vaultId, amount);
  handleBurnShort(burnShort);

  const id = `${burnShort.transaction.hash.toHex()}-${burnShort.logIndex}`;

  assert.fieldEquals("TransactionHistory", id, "transactionType", "BURN_OSQTH");
  assert.fieldEquals(
    "TransactionHistory",
    id,
    "owner",
    openVault.transaction.from.toString()
  );
  assert.fieldEquals("TransactionHistory", id, "oSqthAmount", amount);
});
