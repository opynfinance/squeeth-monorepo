import { atom } from 'jotai'
import { transactions } from '@queries/uniswap/__generated__/transactions'

export const liquidityTxsHistoryAtom = atom<transactions>({ positionSnapshots: [] })
