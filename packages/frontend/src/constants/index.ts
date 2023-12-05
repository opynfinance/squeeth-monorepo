import BigNumber from 'bignumber.js'

export * from './diagram'
export * from './enums'

export const UNI_POOL_FEES = 3000
export const ETH_USDC_POOL_FEES = 500

export const REVERTED_TRANSACTION_CODE = 4001

//17.5 days, 420 hours
export const FUNDING_PERIOD = 17.5

export const DEFAULT_SLIPPAGE = 0.25

export const MIN_COLLATERAL_AMOUNT = 6.9

export const MIN_COLLATERAL_RATIO = 150

export const DEFAULT_COLLATERAL_RATIO = 225

export const YEAR = 365

export const VOL_PERCENT_FIXED = 0.1

export const VOL_PERCENT_SCALAR = 0.1

export const AVERAGE_AUCTION_PRICE_IMPACT = 0.79

export const NETTING_PRICE_IMPACT = 0.2

//7min, 420 seconds
export const TWAP_PERIOD = 420

export const EtherscanPrefix = {
  1: 'https://etherscan.io/tx/',
  3: 'https://ropsten.etherscan.io/tx/',
  5: 'https://goerli.etherscan.io/tx/',
  421611: 'https://rinkeby-explorer.arbitrum.io/tx/',
  31337: '/',
}
export const INDEX_SCALE = 10000
export const OSQUEETH_DECIMALS = 18
export const WETH_DECIMALS = 18
export const USDC_DECIMALS = 6
export const CRAB_TOKEN_DECIMALS = 18
export const BULL_TOKEN_DECIMALS = 18

export const SWAP_EVENT_TOPIC = '0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67'

export const BIG_ZERO = new BigNumber(0)
export const BIG_ONE = new BigNumber(10).pow(18)
export const TWELVEDATA_NO_PRICEDATA_DURATION = 62
export const BLOCKED_COUNTRIES = [
  'US',
  'BY',
  'CU',
  'IR',
  'IQ',
  'CI',
  'LR',
  'KP',
  'SD',
  'SY',
  'ZW',
  'CA',
  'MM',
  'CD',
  'UA',
]
export const ALLOW_WITHDRAWALS = ['CA']

export const BLOCKED_IP_VALUE = 'BLOCKED'

// V2 Migration details
export const V2_MIGRATION_ETH_PRICE = 1611.71
export const V2_MIGRATION_OSQTH_PRICE = 0.0897
export const V2_MIGRATION_ETH_AMOUNT = 790.186510787310292814
export const V2_MIGRATION_OSQTH_AMOUNT = 4604.57349514942255453
export const V2_MIGRATION_SUPPLY = 519.994374902152348633

export const squeethRefVolDocLink = 'https://colab.research.google.com/drive/1HTM_2j0jmda9tzN_uskBPz9Rpma8Lp3C'
export const CRABV2_START_DATE = '2022-07-28'
export const BULL_START_DATE = '2022-12-19'

export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

export const STRATEGY_DEPOSIT_LIMIT = 1000_000
export const SQUEETH_BASE_URL = 'https://opyn.co'

export const SiteMetaTitle = 'Opyn - Stack your ETH and Stables'
export const SiteMetaDescription = 'DeFi Investment Strategies Powered by Squeeth'
export const SiteMetaImage = SQUEETH_BASE_URL + '/images/previews/opyn.png'

export const TOS_UPDATE_DATE = '2023-04-21'
