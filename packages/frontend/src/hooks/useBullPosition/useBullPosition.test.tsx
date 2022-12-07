import { renderHook } from '@testing-library/react-hooks'
import { useBullPosition } from './useBullPosition'
import { Wrapper } from '@utils/atomTester'

describe('useBullPosition', () => {
  const setup = () => {
    return renderHook(() => useBullPosition(), { wrapper: Wrapper })
  }

  describe('loading', () => {
    it('placeholder testcase', () => {
      expect(true).toBe(true)
    })
  })
})
