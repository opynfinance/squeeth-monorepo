import { atom } from 'jotai'
import BigNumber from 'bignumber.js'
import { ZERO_ADDR } from '@constants/address'

export const mockedCrabLoadingAtom = atom(true)
export const mockedCrabPositionValueLoadingAtom = atom(true)

export const mockedCurrentEthValueAtom = atom(new BigNumber(31.502381757505464))

export const mockedIndexAtom = atom(new BigNumber(1.096035041905758e25))

export const mockedUserCrabTxHistoryData = [
  {
    __typename: 'CrabStrategyTx' as const,
    ethAmount: new BigNumber(29.686306442273224),
    id: '0x468ab39dedabebb84e8245dd4a5b2e74a7f7866bad58b2cf9abf7410baa01438',
    lpAmount: new BigNumber(167.1950754262323),
    timestamp: '1646839085',
    type: 'FLASH_DEPOSIT',
    wSqueethAmount: '93257202421547735264',
    oSqueethAmount: new BigNumber(93.25720242154773),
    ethUsdValue: new BigNumber(81181.4599647523),
    txTitle: 'Flash Deposit',
  },
]

export const addressesAtom = atom({ zero: '0x000000000000000000000000000000000000000' })
