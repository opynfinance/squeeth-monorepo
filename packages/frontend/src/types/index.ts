import BigNumber from 'bignumber.js'

declare module '@material-ui/core/styles/createPalette' {
  interface TypeBackground {
    stone: string
    lightStone: string
    tooltip: string
  }
}

export enum Networks {
  MAINNET = 1,
  ROPSTEN = 3,
  LOCAL = 31337,
}

export type Vault = {
  id: number
  NFTCollateralId: string
  collateralAmount: BigNumber
  shortAmount: BigNumber
  operator: string
}
