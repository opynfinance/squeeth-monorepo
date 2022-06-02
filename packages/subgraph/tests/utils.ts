import { Address, ethereum, BigInt } from "@graphprotocol/graph-ts";
import { newMockEvent } from "matchstick-as";
import { BurnShort, OpenVault } from "../generated/Controller/Controller";

function createParameters(
  paramsMap: Map<string, ethereum.Value>
): ethereum.EventParam[] {
  const parameters = [];

  Object.keys(paramsMap).forEach((key) => {
    const value = paramsMap.get(key);

    parameters.push(new ethereum.EventParam(key, value));
  });

  return parameters;
}

export function createOpenVault(vaultId: string): OpenVault {
  const mockEvent = newMockEvent();

  const openVault = new OpenVault(
    mockEvent.address,
    mockEvent.logIndex,
    mockEvent.transactionLogIndex,
    mockEvent.logType,
    mockEvent.block,
    mockEvent.transaction,
    mockEvent.parameters,
    mockEvent.receipt
  );

  const paramsMap = new Map<string, ethereum.Value>();
  paramsMap.set(
    "sender",
    ethereum.Value.fromUnsignedBigInt(BigInt.fromString(vaultId))
  );
  openVault.parameters = createParameters(paramsMap);

  return openVault;
}

export function createBurnShort(
  sender: string,
  vaultId: string,
  amount: string
): BurnShort {
  const mockEvent = newMockEvent();

  const burnShort = new BurnShort(
    mockEvent.address,
    mockEvent.logIndex,
    mockEvent.transactionLogIndex,
    mockEvent.logType,
    mockEvent.block,
    mockEvent.transaction,
    mockEvent.parameters,
    mockEvent.receipt
  );

  const paramsMap = new Map<string, ethereum.Value>();
  paramsMap.set(
    "sender",
    ethereum.Value.fromAddress(Address.fromString(sender))
  );
  paramsMap.set(
    "vaultId",
    ethereum.Value.fromUnsignedBigInt(BigInt.fromString(vaultId))
  );
  paramsMap.set(
    "amount",
    ethereum.Value.fromUnsignedBigInt(BigInt.fromString(amount))
  );
  burnShort.parameters = createParameters(paramsMap);

  return burnShort;
}
