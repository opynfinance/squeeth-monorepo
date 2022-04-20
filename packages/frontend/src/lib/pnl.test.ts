import BigNumber from 'bignumber.js'
import { server } from '../../mocks/server'
import { calcETHCollateralPnl } from './pnl'
import vault_history from '../../tests/fixtures/vault_history.json'

describe('PNL Tests', () => {
  // Establish API mocking before all tests.
  beforeAll(() => server.listen())
  // Reset any request handlers that we may add during the tests,
  // so they don't affect other tests.
  afterEach(() => server.resetHandlers())
  // Clean up after the tests are finished.
  afterAll(() => server.close())

  describe('EthCollateralPnl', () => {
    test('should get the right result', async () => {
      //@ts-expect-error
      const result = await calcETHCollateralPnl(vault_history, new BigNumber(3310.64), new BigNumber(6.9))
      console.log({ result })
    })
  })
})

export {}
