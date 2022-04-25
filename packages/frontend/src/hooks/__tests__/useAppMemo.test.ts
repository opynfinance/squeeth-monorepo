import useAppMemo from '@hooks/useAppMemo'
import { renderHook } from '@testing-library/react-hooks'
import BigNumber from 'bignumber.js'
import { useMemo } from 'react'

jest.mock('react', () => ({
  ...jest.requireActual('react'),
  useMemo: jest.fn(),
}))

describe('useAppMemo', () => {
  const mockedFactory = jest.fn()

  it('calls useMemo with stringified dependencies', () => {
    renderHook(() =>
      useAppMemo(mockedFactory, [
        3,
        'test',
        new BigNumber(5),
        [
          { id: 1, value: 'test' },
          { id: 2, value: 'example' },
        ],
      ]),
    )

    expect(useMemo).toHaveBeenCalledWith(mockedFactory, [3, 'test', '5', '1,2'])
  })
})
