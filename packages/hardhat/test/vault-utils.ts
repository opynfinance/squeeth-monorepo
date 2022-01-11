import {BigNumber} from 'ethers'

type Vault = [string, number, BigNumber, BigNumber] & {
  operator: string
  NftCollateralId: number;
  collateralAmount: BigNumber;
  shortAmount: BigNumber;
  
}

export const isEmptyVault = (vault: Vault): boolean => {
  return vault.collateralAmount.isZero() && vault.shortAmount.isZero()
}

export const UNDERFLOW_ERROR = "reverted with panic code 0x11 (Arithmetic operation underflowed or overflowed outside of an unchecked block)"