import { log } from "@graphprotocol/graph-ts";
import { Transfer } from "../generated/WPowerPerp/WPowerPerp";
import { TOKEN_DECIMALS_18 } from "./constants";
import { convertTokenToDecimal, sqthChange } from "./util";

export function handleTransfer(event: Transfer): void {
  let amount = convertTokenToDecimal(event.params.value, TOKEN_DECIMALS_18);

  log.warning(
    amount.toString() +
      ", " +
      event.params.from.toHex() +
      ", " +
      event.params.to.toHex(),
    []
  );

  sqthChange(event.params.to.toHex(), amount);
  sqthChange(event.params.from.toHex(), amount.neg());
}
