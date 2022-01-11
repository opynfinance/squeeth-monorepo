export enum TradeMode {
  Buy,
  Sell,
}

export enum Vaults {
  ETHBear = 'ETH Bear Yield Strategy', // long 1 eth + short squeeth
  CrabVault = 'Crab Strategy', // long 2 eth + short squeeth
  ETHBull = 'ETH Bull Yield Strategy', // long 3 eth + short squeeth
  Custom = 'Custom Strategy', // long x eth + short squeeth
  Short = 'Short Squeeth', //pure short squeeth
}

export enum TransactionType {
  BUY = 'Bought',
  SELL = 'Sold',
  MINT_SHORT = 'Minted and sold',
  BURN_SHORT = 'Bought back and burned',
}

export enum CloseType {
  PARTIAL = 'PartialClose',
  FULL = 'FullClose',
}

export enum InputType {
  ETH = 'ETH',
  SQTH = 'SQTH',
}

export enum Tooltips {
  ImplVol = 'Implied Volatility (IV) is a market forecast of ETH price movement implied by squeeth',
  UnrealizedPnL = 'Total profit / loss if you were to fully close your position at the current oSQTH price on Uniswap. Resets if you close your position or change position sides (long to short, or vice versa)',
  RealizedPnL = 'Total realized profit / loss for this position through partial closes. Resets if you fully close your position or change position sides (long to short, or vice versa)',
  Mark = 'The price squeeth is trading at. Because squeeth has convexity, Mark should be greater than ETH^2',
  Last30MinAvgFunding = 'Historical daily funding based on the last 30min. Calculated using a 30min TWAP of Mark - Index',
  CurrentImplFunding = 'Expected daily funding based on current price, calculated using current Mark - Index',
  FundingPayments = 'Funding happens every time the contract is touched',
  oSQTHPrice = 'Price of oSQTH on Uniswap',
  LPPnL = 'PnL = Value of current LP underlying tokens including uncollected fees - Value of tokens deposited (at current price)',
  UniswapLoading = 'When you click the Uniswap link, the Uniswap LP page may take a few moments to load. Please wait for it to fully load so it can prefill LP token data.',
  Operator = 'The wrapper contract mints squeeth, deposits collateral and sells squeeth in single TX. Similarly it also buys back + burns squeeth and withdraws collateral in single TX',
  SellCloseAmount = 'Amount of oSQTH to buy',
  CurrentCollRatio = 'Collateral ratio for current short position',
  SellOpenAmount = 'Minimum collateral amount is 7.5 ETH to ensure system solvency with sufficient liquidation incentive',
  LiquidationPrice = 'Price of ETH when liquidation occurs',
  InitialPremium = 'Initial payment you get for selling squeeth on Uniswap',
  BacktestDisclaimer = 'This is historical backtest data and does not show the actual performance of squeeth. See the FAQ to learn more.',
  PercentOfPool = 'The amount of your liquidity compared to all current active liquidity',
  SpotPrice = 'This is a spot price from Uniswap',
  Twap = 'This is a 7 min TWAP from Uniswap.',
  MintBurnInput = 'Input a negative number (with a minus sign on the extreme left) to burn, and a positive number (no sign needed) to mint.',
  CollatRemoveAdd = 'Input a negative number (with a minus sign on the extreme left) to remove, and a positive number (no sign needed) to add.',
  MintedDebt = 'This is squeeth debt for which you have put down collateral to acquire.',
  ShortDebt = 'This is squeeth that you acquired and sold',
  LPDebt = 'This is squeeth which you have opened a Uniswap pool to trade.',
  TotalDebt = 'Debt of the vault',
}

export enum Links {
  BacktestFAQ = 'https://opyn.gitbook.io/squeeth/resources/squeeth-faq#what-is-the-historical-365d-pnl',
  GitBook = 'https://opyn.gitbook.io/squeeth/',
  UniswapSwap = 'https://app.uniswap.org/#/swap?inputCurrency=ETH&outputCurrency=0xf1B99e3E573A1a9C5E6B2Ce818b617F0E664E86B',
}

export const UniswapIFrameOpen = {
  1: 'https://app.uniswap.org/#/add/ETH/0xf1B99e3E573A1a9C5E6B2Ce818b617F0E664E86B/3000',
  3: 'https://squeeth-uniswap.netlify.app/#/add/ETH/0x2c1d37d7d8444B24c14064e35aD1B37E5f7B6035/3000',
  31337: 'https://app.uniswap.org/#/add/ETH/0xf1B99e3E573A1a9C5E6B2Ce818b617F0E664E86B/3000', // Should be replaced with arbitrum subgraph
  421611: 'https://app.uniswap.org/#/add/ETH/0xf1B99e3E573A1a9C5E6B2Ce818b617F0E664E86B/3000', // Should be replaced with arbitrum subgraph
}

export const UniswapIFrameClose = {
  1: 'https://app.uniswap.org/#/pool',
  3: 'https://squeeth-uniswap.netlify.app/#/pool',
  31337: 'https://app.uniswap.org/#/add/ETH/0xf1B99e3E573A1a9C5E6B2Ce818b617F0E664E86B/3000', // Should be replaced with arbitrum subgraph
  421611: 'https://app.uniswap.org/#/add/ETH/0xf1B99e3E573A1a9C5E6B2Ce818b617F0E664E86B/3000', // Should be replaced with arbitrum subgraph
}
