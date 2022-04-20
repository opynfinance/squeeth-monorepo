import stringifyDeps from '@utils/stringifyDeps'
import BigNumber from 'bignumber.js'

describe('stringifyDeps', () => {
  it('stringify big number dependency', () => {
    const result = stringifyDeps([5, 'test', new BigNumber(125), ['a', 'b'], {}])

    expect(result).toEqual([5, 'test', '125', ['a', 'b'], {}])
  })

  it('stringify array if elements contain id property', () => {
    const result = stringifyDeps([
      5,
      'test',
      [
        { id: 3, value: 1228 },
        { id: 4, value: 1229 },
      ],
      ['a', 'b'],
      {},
    ])

    expect(result).toEqual([5, 'test', '3,4', ['a', 'b'], {}])
  })

  it('returns original array if elements do not contain id property', () => {
    const result = stringifyDeps([
      5,
      'test',
      [
        { description: 'test', value: 1228 },
        { descrioption: 'example', value: 1229 },
      ],
      ['a', 'b'],
      {},
    ])

    expect(result).toEqual([
      5,
      'test',
      [
        { description: 'test', value: 1228 },
        { descrioption: 'example', value: 1229 },
      ],
      ['a', 'b'],
      {},
    ])
  })
})
