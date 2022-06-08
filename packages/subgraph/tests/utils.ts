import { Address, ethereum, BigInt } from "@graphprotocol/graph-ts";
import { newMockEvent } from "matchstick-as";
import {
  BurnShort,
  DepositCollateral,
  MintShort,
  OpenVault,
  WithdrawCollateral,
} from "../generated/Controller/Controller";
import { Transfer } from "../generated/WPowerPerp/WPowerPerp";

export function createOpenVault(vaultId: string): OpenVault {
  let event = changetype<OpenVault>(newMockEvent());

  let parameters = new Array<ethereum.EventParam>();
  parameters.push(
    new ethereum.EventParam(
      "sender",
      ethereum.Value.fromAddress(
        Address.fromString("0x0744905ed8cb4076fc6d971730876a1c6474f69a")
      )
    )
  );
  parameters.push(
    new ethereum.EventParam(
      "vaultId",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromString(vaultId))
    )
  );
  event.parameters = parameters;

  return event;
}

export function createMintShort(
  sender: string,
  vaultId: string,
  amount: string
): MintShort {
  let event = changetype<MintShort>(newMockEvent());

  let parameters = new Array<ethereum.EventParam>();
  parameters.push(
    new ethereum.EventParam(
      "sender",
      ethereum.Value.fromAddress(Address.fromString(sender))
    )
  );
  parameters.push(
    new ethereum.EventParam(
      "amount",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromString(amount))
    )
  );
  parameters.push(
    new ethereum.EventParam(
      "vaultId",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromString(vaultId))
    )
  );
  event.parameters = parameters;

  return event;
}

export function createBurnShort(
  sender: string,
  vaultId: string,
  amount: string
): BurnShort {
  let event = changetype<BurnShort>(newMockEvent());

  let parameters = new Array<ethereum.EventParam>();
  parameters.push(
    new ethereum.EventParam(
      "sender",
      ethereum.Value.fromAddress(Address.fromString(sender))
    )
  );
  parameters.push(
    new ethereum.EventParam(
      "amount",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromString(amount))
    )
  );
  parameters.push(
    new ethereum.EventParam(
      "vaultId",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromString(vaultId))
    )
  );
  event.parameters = parameters;

  return event;
}

export function createDepositCollateral(
  sender: string,
  vaultId: string,
  amount: string
): DepositCollateral {
  let event = changetype<DepositCollateral>(newMockEvent());

  let parameters = new Array<ethereum.EventParam>();
  parameters.push(
    new ethereum.EventParam(
      "sender",
      ethereum.Value.fromAddress(Address.fromString(sender))
    )
  );
  parameters.push(
    new ethereum.EventParam(
      "vaultId",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromString(vaultId))
    )
  );
  parameters.push(
    new ethereum.EventParam(
      "amount",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromString(amount))
    )
  );
  event.parameters = parameters;

  return event;
}

export function createWithdrawCollateral(
  sender: string,
  vaultId: string,
  amount: string
): WithdrawCollateral {
  let event = changetype<WithdrawCollateral>(newMockEvent());

  let parameters = new Array<ethereum.EventParam>();
  parameters.push(
    new ethereum.EventParam(
      "sender",
      ethereum.Value.fromAddress(Address.fromString(sender))
    )
  );
  parameters.push(
    new ethereum.EventParam(
      "vaultId",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromString(vaultId))
    )
  );
  parameters.push(
    new ethereum.EventParam(
      "amount",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromString(amount))
    )
  );
  event.parameters = parameters;

  return event;
}

export function createTransfer(
  from: string,
  to: string,
  value: string
): Transfer {
  let event = changetype<Transfer>(newMockEvent());

  let parameters = new Array<ethereum.EventParam>();
  parameters.push(
    new ethereum.EventParam(
      "from",
      ethereum.Value.fromAddress(Address.fromString(from))
    )
  );
  parameters.push(
    new ethereum.EventParam(
      "to",
      ethereum.Value.fromAddress(Address.fromString(to))
    )
  );
  parameters.push(
    new ethereum.EventParam(
      "value",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromString(value))
    )
  );
  event.parameters = parameters;

  return event;
}
