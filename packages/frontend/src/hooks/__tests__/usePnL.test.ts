import usePnL from '@hooks/usePnL'
import useCurrentPrices from '@hooks/useCurrentPrices'
import useTransactionHistories, { TransactionHistory } from '@hooks/useTransactionHistories'
import { TransactionType } from 'types/global_apollo'
import BigNumber from 'bignumber.js'
import { renderHook } from '@testing-library/react-hooks'

const mockTransactionHistories = (histories: Partial<TransactionHistory>[]) => {
  ;(useTransactionHistories as jest.Mock).mockReturnValue(histories)
}

const mockCurrentPrices = (prices: ReturnType<typeof useCurrentPrices>) => {
  ;(useCurrentPrices as jest.Mock).mockReturnValue(prices)
}

describe('usePnL', () => {
  describe('buy 1 oSQTH 0.2 ETH, ETH at 3k', () => {
    it('when ETH price is 3100 and oSQTH price is 0.25 ETH', () => {
      mockTransactionHistories([
        {
          transactionType: TransactionType.BUY_OSQTH,
          oSqthAmount: new BigNumber(1),
          oSqthPrice: new BigNumber(0.2),
          ethPrice: new BigNumber(3000),
        },
      ])

      mockCurrentPrices({ ethPrice: new BigNumber(3100), oSqthPrice: new BigNumber(0.25) })

      const { result } = renderHook(() => usePnL())

      expect(result.current.unrealizePnL.toNumber()).toBe(175)
    })

    it('when ETH price is 2900 and oSQTH price is 0.15 ETH', () => {
      mockTransactionHistories([
        {
          transactionType: TransactionType.BUY_OSQTH,
          oSqthAmount: new BigNumber(1),
          oSqthPrice: new BigNumber(0.2),
          ethPrice: new BigNumber(3000),
        },
      ])

      mockCurrentPrices({ ethPrice: new BigNumber(2900), oSqthPrice: new BigNumber(0.15) })

      const { result } = renderHook(() => usePnL())

      expect(result.current.unrealizePnL.toNumber()).toBe(-165)
    })

    it('sell 0.5 oSQTH when ETH price is 3100 and oSQTH price is 0.25 ETH', () => {
      mockTransactionHistories([
        {
          transactionType: TransactionType.BUY_OSQTH,
          oSqthAmount: new BigNumber(1),
          oSqthPrice: new BigNumber(0.2),
          ethPrice: new BigNumber(3000),
        },
        {
          transactionType: TransactionType.SELL_OSQTH,
          oSqthAmount: new BigNumber(0.5),
          oSqthPrice: new BigNumber(0.25),
          ethPrice: new BigNumber(3100),
        },
      ])

      mockCurrentPrices({ ethPrice: new BigNumber(3100), oSqthPrice: new BigNumber(0.25) })

      const { result } = renderHook(() => usePnL())

      expect(result.current.realizePnL.toNumber()).toBe(87.5)
      expect(result.current.unrealizePnL.toNumber()).toBe(87.5)
    })

    describe('LP it with 0.3 ETH when ETH price is 3100 and oSQTH price is 0.25 ETH', () => {
      it('', () => {
        mockTransactionHistories([
          {
            transactionType: TransactionType.BUY_OSQTH,
            oSqthAmount: new BigNumber(1),
            oSqthPrice: new BigNumber(0.2),
            ethPrice: new BigNumber(3000),
          },
          {
            transactionType: TransactionType.ADD_LIQUIDITY,
            ethAmount: new BigNumber(0.3),
            oSqthAmount: new BigNumber(1.2),
            oSqthPrice: new BigNumber(0.25),
            ethPrice: new BigNumber(3100),
          },
        ])

        mockCurrentPrices({ ethPrice: new BigNumber(3100), oSqthPrice: new BigNumber(0.25) })

        const { result } = renderHook(() => usePnL())

        expect(result.current.realizePnL.toNumber()).toBe(175)
        expect(result.current.unrealizePnL.toNumber()).toBe(0)
      })

      it('close LP when ETH price is 2900 and oSQTH price is 0.2 ETH', () => {
        mockTransactionHistories([
          {
            transactionType: TransactionType.BUY_OSQTH,
            oSqthAmount: new BigNumber(1),
            oSqthPrice: new BigNumber(0.2),
            ethPrice: new BigNumber(3000),
          },
          {
            transactionType: TransactionType.ADD_LIQUIDITY,
            ethAmount: new BigNumber(0.3),
            oSqthAmount: new BigNumber(1.2),
            oSqthPrice: new BigNumber(0.25),
            ethPrice: new BigNumber(3100),
          },
          {
            transactionType: TransactionType.REMOVE_LIQUIDITY,
            ethAmount: new BigNumber(0.2),
            oSqthAmount: new BigNumber(1.2),
            oSqthPrice: new BigNumber(0.2),
            ethPrice: new BigNumber(2900),
          },
        ])

        mockCurrentPrices({ ethPrice: new BigNumber(2900), oSqthPrice: new BigNumber(0.2) })

        const { result } = renderHook(() => usePnL())

        expect(result.current.realizePnL.toNumber()).toBe(-429)
        expect(result.current.unrealizePnL.toNumber()).toBe(0)
      })
    })
  })
})
