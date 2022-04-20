import BigNumber from 'bignumber.js'
import MockDate from 'mockdate'

import { server } from '../../../mocks/server'
import {
  calcETHCollateralPnl,
  calcDollarShortUnrealizedpnl,
  calcDollarLongUnrealizedpnl,
  getRelevantSwaps,
  getEthPriceAtTransactionTime,
  queryClient,
} from '../pnl'
import vault_history from '../../../tests/fixtures/vault_history.json'
// swaps with open short position
import swaps01 from '../../../tests/fixtures/swaps_01.json'

//swaps with open long position
import swaps02 from '../../../tests/fixtures/swaps_02.json'

const CURRENT_ETH_PRICE = new BigNumber('3103.55')
let ethCollateralPnl: BigNumber

describe('Unrealized PNL Tests', () => {
  // Establish API mocking before all tests.
  beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }))
  // Reset any request handlers that we may add during the tests,
  // so they don't affect other tests.
  afterEach(() => {
    server.resetHandlers()
    queryClient.clear()
    MockDate.reset()
  })
  // Clean up after the tests are finished.
  afterAll(() => server.close())

  describe('EthCollateralPnl', () => {
    test('should get the right result', async () => {
      const currentVaultEthBalance = new BigNumber('8.303039283731850852')

      const result = await calcETHCollateralPnl(
        //@ts-expect-error
        vault_history,
        CURRENT_ETH_PRICE,
        currentVaultEthBalance,
      )
      ethCollateralPnl = result
      const pnl = Number(result.toFixed(2))
      expect(pnl).toBe(-424.3)
    })
  })

  describe('ShortUnrealizedPnl', () => {
    test('should get the correct pnl', async () => {
      const isWethToken0 = false
      const buyQuote = new BigNumber('3.9545364517509141')
      const squeethAmount = new BigNumber('16.021694075448964012')
      const result = await calcDollarShortUnrealizedpnl(
        //@ts-expect-error
        swaps01,
        isWethToken0,
        buyQuote,
        CURRENT_ETH_PRICE,
        squeethAmount,
        ethCollateralPnl,
      )

      const shortUnrealizedPNL = Number(result.usd.toFixed(2))
      expect(shortUnrealizedPNL).toBe(-320.65)
    })
  })

  describe('LongUnrealizedPnl', () => {
    test('should get the correct pnl', async () => {
      const isWethToken0 = false
      const sellQuote = {
        amountOut: new BigNumber('1.49103011155230043'),
        minimumAmountOut: new BigNumber('1.48361205129582132'),
        priceImpact: '0.67',
      }
      const squeethAmount = new BigNumber('5.995745227115764621')

      const result = await calcDollarLongUnrealizedpnl(
        //@ts-expect-error
        swaps02,
        isWethToken0,
        sellQuote,
        CURRENT_ETH_PRICE,
        squeethAmount,
      )
      const longUnrealizedPNL = Number(result.usd.toFixed(2))
      expect(longUnrealizedPNL).toBe(-21.91)
    })
  })

  describe('getRelevantSwaps', () => {
    test('LONG: should get the right relevant swaps', async () => {
      const squeethAmount = new BigNumber('5.995745227115764621')
      const isWethToken0 = false
      const isLong = true
      //@ts-expect-error
      const result = getRelevantSwaps(squeethAmount, swaps02, isWethToken0, isLong)
      expect(result.length).toBe(2)
    })

    test('SHORT: should get the right relevant swaps', async () => {
      const squeethAmount = new BigNumber('16.021694075448964012')
      const isWethToken0 = false
      const isLong = false
      //@ts-expect-error
      const result = getRelevantSwaps(squeethAmount, swaps01, isWethToken0, isLong)
      expect(result.length).toBe(3)
    })
  })

  describe('getEthPriceAtTransactionTime', () => {
    test('should get price from coingecko', async () => {
      MockDate.set(1650446400000)
      const price = await getEthPriceAtTransactionTime('1650445835')
      expect(Number(price.toFixed(2))).toBe(3103.85)
    })

    test('should get price from twelvedata', async () => {
      MockDate.set(1650450600000)
      const result = await getEthPriceAtTransactionTime('1650445835')
      const price = Number(result.toFixed(2))
      expect(price).toBe(3099.3)
    })
  })
})
