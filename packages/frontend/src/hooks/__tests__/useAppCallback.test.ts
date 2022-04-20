import useAppCallback from '@hooks/useAppCallback'
import { renderHook } from '@testing-library/react-hooks'
import BigNumber from 'bignumber.js'
import { useCallback } from 'react'

jest.mock('react', () => ({
  ...jest.requireActual('react'),
  useCallback: jest.fn(),
}))

describe('useAppCallback', () => {
  const mockedCallback = jest.fn()

  it('calls useCallback with stringified dependencies', () => {
    renderHook(() =>
      useAppCallback(mockedCallback, [
        3,
        'test',
        new BigNumber(5),
        [
          { id: 1, value: 'test' },
          { id: 2, value: 'example' },
        ],
      ]),
    )

    expect(useCallback).toHaveBeenCalledWith(mockedCallback, [3, 'test', '5', '1,2'])
  })
})
