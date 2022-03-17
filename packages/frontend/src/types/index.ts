import BigNumber from 'bignumber.js'

import { positions_positions } from '../queries/uniswap/__generated__/positions'

declare module '@material-ui/core/styles/createPalette' {
  interface TypeBackground {
    stone: string
    lightStone: string
    tooltip: string
    border: string
  }
}

declare module '@material-ui/core/styles/createTypography' {
  interface Typography {
    body3: React.CSSProperties
  }

  // allow configuration using `createMuiTheme`
  interface TypographyOptions {
    body3?: React.CSSProperties
  }
}

declare module '@material-ui/core/Typography/Typography' {
  interface TypographyPropsVariantOverrides {
    body3: true
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

export type NormHistory = {
  id: string
  oldNormFactor: string
  newNormFactor: string
  lastModificationTimestamp: string
  timestamp: string
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
  HEDGE_ON_UNISWAP = 'HEDGE_ON_UNISWAP',
  HEDGE = 'HEDGE',
}
