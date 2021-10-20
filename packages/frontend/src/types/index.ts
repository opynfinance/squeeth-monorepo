import BigNumber from 'bignumber.js'

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
