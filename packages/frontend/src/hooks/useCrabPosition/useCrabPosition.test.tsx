import { renderHook } from '@testing-library/react-hooks'
import { useCrabPosition } from './useCrabPosition'
import { Wrapper, writeAtom } from '@utils/atomTester'
import { mockedCrabLoadingAtom, mockedUserCrabTxHistoryData, mockedCrabPositionValueLoadingAtom } from './mocks'
import { useUserCrabTxHistory } from '@hooks/useUserCrabTxHistory'
import { act } from 'react-dom/test-utils'

jest.mock('src/state/crab/atoms', () => ({
  crabLoadingAtom: jest.requireActual('./mocks').mockedCrabLoadingAtom,
  currentCrabPositionValueInETHAtom: jest.requireActual('./mocks').mockedCurrentEthValueAtom,
  crabPositionValueLoadingAtom: jest.requireActual('./mocks').mockedCrabPositionValueLoadingAtom,
}))

jest.mock('src/state/controller/atoms', () => ({
  indexAtom: jest.requireActual('./mocks').mockedIndexAtom,
}))

jest.mock('src/state/positions/atoms', () => ({
  addressesAtom: jest.requireActual('./mocks').addressesAtom,
}))

jest.mock('../useUserCrabTxHistory', () => ({
  useUserCrabTxHistory: jest.fn(),
}))

afterEach(() => {
  jest.clearAllMocks()

  // Reset crab loading
  act(() => {
    writeAtom(mockedCrabLoadingAtom, true)
    writeAtom(mockedCrabPositionValueLoadingAtom, true)
  })
})

describe('useCrabPosition', () => {
  const mockTransactionHistory = (mockedUserCrabTxHistory: Partial<ReturnType<typeof useUserCrabTxHistory>>) => {
    ;(useUserCrabTxHistory as jest.Mock).mockReturnValue(mockedUserCrabTxHistory)
  }

  const setup = () => {
    return renderHook(() => useCrabPosition(''), { wrapper: Wrapper })
  }

  describe('loading', () => {
    it('returns true if crab is loading', () => {
      mockTransactionHistory({ loading: false, data: mockedUserCrabTxHistoryData })

      const { result } = setup()

      expect(result.current.loading).toBe(true)
    })

    it('returns true if transaction history is loading', () => {
      mockTransactionHistory({ loading: true, data: [] })

      const { result, rerender } = setup()

      // Make sure crab is not loading
      act(() => {
        writeAtom(mockedCrabLoadingAtom, false)
      })

      rerender()

      expect(result.current.loading).toBe(true)
    })

    it('returns false if crab and transaction history are loaded', () => {
      mockTransactionHistory({ loading: false, data: mockedUserCrabTxHistoryData })

      const { result, rerender } = setup()

      act(() => {
        writeAtom(mockedCrabLoadingAtom, false)
      })
      rerender()

      expect(result.current.loading).toBe(false)
    })
  })

  describe('depositedEth and depositedUsd', () => {
    it('returns 0 if user crab history is loading', () => {
      mockTransactionHistory({ loading: true, data: [] })

      const { result } = setup()

      expect(result.current.depositedEth.toNumber()).toBe(0)
      expect(result.current.depositedUsd.toNumber()).toBe(0)
    })

    it('returns correct value after user crab history is loaded', () => {
      mockTransactionHistory({ loading: true, data: [] })

      const { result, rerender } = setup()

      mockTransactionHistory({ loading: false, data: mockedUserCrabTxHistoryData })
      rerender()

      expect(result.current.depositedEth.toNumber()).toBe(29.686306442273224)
      expect(result.current.depositedUsd.toNumber()).toBe(81181.4599647523)
    })
  })

  describe('minCurrentEth and minCurrentUsd', () => {
    it('returns 0 if crab is loading', () => {
      mockTransactionHistory({ loading: false, data: mockedUserCrabTxHistoryData })

      const { result } = setup()

      expect(result.current.minCurrentEth.toNumber()).toBe(0)
      expect(result.current.minCurrentUsd.toNumber()).toBe(0)
    })

    it('returns 0 if user crab history is loading', () => {
      mockTransactionHistory({ loading: true, data: [] })

      const { result, rerender } = setup()

      act(() => {
        writeAtom(mockedCrabLoadingAtom, false)
      })
      rerender()

      expect(result.current.minCurrentEth.toNumber()).toBe(0)
      expect(result.current.minCurrentUsd.toNumber()).toBe(0)
    })

    it('returns correct value after crab and user crab history are loaded', () => {
      mockTransactionHistory({ loading: true, data: [] })

      const { result, rerender } = setup()

      act(() => {
        writeAtom(mockedCrabLoadingAtom, false)
        writeAtom(mockedCrabPositionValueLoadingAtom, false)
      })
      rerender()

      mockTransactionHistory({ loading: false, data: mockedUserCrabTxHistoryData })
      rerender()

      expect(result.current.minCurrentEth.toNumber()).toBe(31.502381757505464)
      expect(result.current.minCurrentUsd.toNumber()).toBe(104293.1079889195)
    })
  })

  describe('minPnL and minPnlUsd', () => {
    it('returns 0 if crab is loading', () => {
      mockTransactionHistory({ loading: false, data: mockedUserCrabTxHistoryData })

      const { result } = setup()

      expect(result.current.minPnL.toNumber()).toBe(0)
      expect(result.current.minPnlUsd.toNumber()).toBe(0)
    })

    it('returns 0 if user crab history is loading', () => {
      mockTransactionHistory({ loading: true, data: [] })

      const { result, rerender } = setup()

      act(() => {
        writeAtom(mockedCrabLoadingAtom, false)
      })
      rerender()

      expect(result.current.minPnL.toNumber()).toBe(0)
      expect(result.current.minPnlUsd.toNumber()).toBe(0)
    })

    it('returns correct value after crab and user crab history are loaded', () => {
      mockTransactionHistory({ loading: true, data: [] })

      const { result, rerender } = setup()

      act(() => {
        writeAtom(mockedCrabLoadingAtom, false)
        writeAtom(mockedCrabPositionValueLoadingAtom, false)
      })
      rerender()

      mockTransactionHistory({ loading: false, data: mockedUserCrabTxHistoryData })
      rerender()

      expect(result.current.minPnL.toNumber()).toBe(28.469120947322093)
      expect(result.current.minPnlUsd.toNumber()).toBe(23111.648024167196)
    })
  })
})
