import {BigNumber} from 'ethers'
import { BigNumber as BigNumberJs } from "bignumber.js"

type Vault = [BigNumber, BigNumber, BigNumber] & {
  NftCollateralId: BigNumber;
  collateralAmount: BigNumber;
  shortAmount: BigNumber;
}

export const isEmptyVault = (vault: Vault): boolean => {
  return vault.collateralAmount.isZero() && vault.shortAmount.isZero()
}

export const isSimilar = (number1: string, number2: string, precision: number= 4) => {
  const error = 1/(10 ** precision)
  return new BigNumberJs(number1).div(new BigNumberJs(number2)).minus(1).abs().lt(error)
}

export const getNow = async(provider: any) => {
  const blockNumBefore = await provider.getBlockNumber();
  const blockBefore = await provider.getBlock(blockNumBefore);
  return blockBefore.timestamp;
}

export const UNDERFLOW_ERROR = "reverted with panic code 0x11 (Arithmetic operation underflowed or overflowed outside of an unchecked block)"