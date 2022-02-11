import BigNumber from 'bignumber.js'

export * from './diagram'
export * from './enums'

export const UNI_POOL_FEES = 3000

//17.5 days, 420 hours
export const FUNDING_PERIOD = 17.5

export const DEFAULT_SLIPPAGE = 0.5

export const MIN_COLLATERAL_AMOUNT = 6.9

//7min, 420 seconds
export const TWAP_PERIOD = 420

export const EtherscanPrefix = {
  1: 'https://etherscan.io/tx/',
  3: 'https://ropsten.etherscan.io/tx/',
  421611: 'https://rinkeby-explorer.arbitrum.io/tx/',
  31337: '/',
}
export const INDEX_SCALE = 10000
export const OSQUEETH_DECIMALS = 18
export const WETH_DECIMALS = 18

export const SWAP_EVENT_TOPIC = '0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67'

export const BIG_ZERO = new BigNumber(0)

export const POLLING_INTERVAL = 30000
