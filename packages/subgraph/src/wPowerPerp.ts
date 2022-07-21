import { Address, log } from "@graphprotocol/graph-ts";
import { Transfer } from "../generated/WPowerPerp/WPowerPerp";
import { TOKEN_DECIMALS_18 } from "./constants";
import { convertTokenToDecimal, sqthChange } from "./util";

export function handleTransfer(event: Transfer): void {
  let amount = convertTokenToDecimal(event.params.value, TOKEN_DECIMALS_18);

  // If it's for minting/burning, ignore PnL calc
  if (
    event.transaction.from === Address.empty() ||
    event.transaction.to === Address.empty()
  ) {
    return;
  }

  sqthChange(event.transaction.from.toHex(), amount.neg());
  if (event.transaction.to) {
    sqthChange(event.transaction.to.toHex(), amount);
  }
}
