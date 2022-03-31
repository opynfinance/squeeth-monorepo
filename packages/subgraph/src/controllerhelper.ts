import { FlashswapSellLongWMintCall__Inputs } from "../generated/ControllerHelper/ControllerHelper";
import { Vault } from "../generated/schema";
import { BIGINT_ZERO, CONTROLLER_HELPER_ADDR } from "./constants";
import { getTransactionDetail } from "./controller";

export function handleFlashswapSellLongWMint(
  callHandler: FlashswapSellLongWMintCall__Inputs
): void {
  const vault = Vault.load(callHandler._params.vaultId.toString());
  if (!vault) return;

  vault.shortAmount = vault.shortAmount.plus(
    callHandler._params.wPowerPerpAmountToMint
  );
  vault.save();

  let timestamp = callHandler._call.block.timestamp;
  let transactionHash = callHandler._call.transaction.hash.toHex();
  //check if users manually mint or using controller to close position
  //if directly sent to controller helper address, then it's open short in 1 step, if directly sent to controller address, then it's mint
  let actionType: string;
  if (callHandler._call.from == CONTROLLER_HELPER_ADDR) {
    actionType = "FLASH_SWAP_W_MINT";
  } else {
    actionType = "MINT";
  }

  //update vault history
  const vaultTransaction = getTransactionDetail(
    callHandler._params.vaultId,
    callHandler._params.wPowerPerpAmountToMint,
    vault,
    timestamp,
    actionType,
    transactionHash,
    BIGINT_ZERO
  );
  vaultTransaction.save();
}

export function handleDepositCollateral(
  callHandler: FlashswapSellLongWMintCall__Inputs
): void {
  const vault = Vault.load(callHandler._params.vaultId.toString());
  if (!vault) return;

  vault.collateralAmount = vault.collateralAmount.plus(
    callHandler._params.collateralAmount
  );
  vault.save();

  let timestamp = callHandler._call.block.timestamp;
  let transactionHash = callHandler._call.transaction.hash.toHex();

  //update vault history
  const vaultTransaction = getTransactionDetail(
    callHandler._params.vaultId,
    callHandler._params.collateralAmount,
    vault,
    timestamp,
    "DEPOSIT_COLLAT",
    transactionHash,
    BIGINT_ZERO
  );
  vaultTransaction.save();
}
