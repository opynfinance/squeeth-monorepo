import useAppEffect from '@hooks/useAppEffect'
import { renderHook } from '@testing-library/react-hooks'
import BigNumber from 'bignumber.js'

beforeEach(() => {
  jest.clearAllMocks()
})

describe('useAppEffect', () => {
  const mockedEffect = jest.fn()

  it('runs effect initially', () => {
    const deps = [3, 'test']

    renderHook(() => useAppEffect(mockedEffect, deps))

    expect(mockedEffect).toHaveBeenCalled()
  })

  it('runs effect when depedency is changed', () => {
    const { rerender } = renderHook(({ deps }) => useAppEffect(mockedEffect, deps), {
      initialProps: { deps: [3, 'test'] },
    })

    rerender({ deps: [3, 'test changed'] })

    expect(mockedEffect).toHaveBeenCalledTimes(2)
  })

  it('does not run effect when big number string is not changed', () => {
    const { rerender } = renderHook(({ deps }) => useAppEffect(mockedEffect, deps), {
      initialProps: { deps: [new BigNumber(3), 'test'] },
    })

    rerender({ deps: [new BigNumber(3), 'test'] })

    expect(mockedEffect).toHaveBeenCalledTimes(1)
  })

  it('runs effect when big number string is changed', () => {
    const { rerender } = renderHook(({ deps }) => useAppEffect(mockedEffect, deps), {
      initialProps: { deps: [new BigNumber(3), 'test'] },
    })

    rerender({ deps: [new BigNumber(3.5), 'test'] })

    expect(mockedEffect).toHaveBeenCalledTimes(2)
  })

  it('does not run effect when ids of array are not changed', () => {
    const { rerender } = renderHook(({ deps }) => useAppEffect(mockedEffect, deps), {
      initialProps: {
        deps: [
          [
            { id: 3, value: '232' },
            { id: 4, value: '456' },
          ],
          'test',
        ],
      },
    })

    rerender({
      deps: [
        [
          { id: 3, value: '232' },
          { id: 4, value: '456' },
        ],
        'test',
      ],
    })

    expect(mockedEffect).toHaveBeenCalledTimes(1)
  })

  it('runs effect when ids of array are changed', () => {
    const { rerender } = renderHook(({ deps }) => useAppEffect(mockedEffect, deps), {
      initialProps: {
        deps: [
          [
            { id: 3, value: '232' },
            { id: 4, value: '456' },
          ],
          'test',
        ],
      },
    })

    rerender({
      deps: [
        [
          { id: 4, value: '232' },
          { id: 4, value: '456' },
        ],
        'test',
      ],
    })

    expect(mockedEffect).toHaveBeenCalledTimes(2)
  })
})
