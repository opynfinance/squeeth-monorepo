import { Transfer } from "../generated/CrabStrategy/CrabStrategy";
import { TOKEN_DECIMALS_18 } from "./constants";
import { convertTokenToDecimal } from "./util";

export function handleTransfer(event: Transfer): void {
  let amount = convertTokenToDecimal(event.params.value, TOKEN_DECIMALS_18);
}
