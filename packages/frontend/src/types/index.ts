import BigNumber from 'bignumber.js'

import { positions_positions } from '../queries/uniswap/__generated__/positions'

declare module '@material-ui/core/styles/createPalette' {
  interface TypeBackground {
    stone: string
    lightStone: string
    tooltip: string
  }
}

declare module '@material-ui/core/styles' {
  interface TypographyVariants {
    number: React.CSSProperties
  }
}

// Update the Typography's variant prop options
declare module '@material-ui/core/Typography' {
  interface TypographyPropsVariantOverrides {
    number: true
  }
}

export enum Networks {
  MAINNET = 1,
  ROPSTEN = 3,
  ARBITRUM_RINKEBY = 421611,
  LOCAL = 31337,
}

export type Vault = {
  id: number
  NFTCollateralId: string
  collateralAmount: BigNumber
  shortAmount: BigNumber
  operator: string
}

export enum PositionType {
  NONE = 'None',
  LONG = 'Long',
  SHORT = 'Short',
}

export enum TradeType {
  LONG,
  SHORT,
}
export interface NFTManagers extends positions_positions {
  fees0?: BigNumber
  fees1?: BigNumber
  amount0?: BigNumber
  amount1?: BigNumber
  dollarValue: BigNumber
}

export enum CollateralStatus {
  SAFE = 'SAFE',
  RISKY = 'RISKY',
  DANGER = 'DANGER',
}

export enum CrabStrategyTxType {
  DEPOSIT = 'DEPOSIT',
  WITHDRAW = 'WITHDRAW',
  FLASH_DEPOSIT = 'FLASH_DEPOSIT',
  FLASH_WITHDRAW = 'FLASH_WITHDRAW',
}
