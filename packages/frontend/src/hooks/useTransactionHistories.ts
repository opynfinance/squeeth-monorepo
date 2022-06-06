import { useQuery } from '@apollo/client'
import { TRANSACTION_HISTORIES_QUERY } from '@queries/squeeth/transactionHistoriesQuery'
import {
  TransactionHistories,
  TransactionHistoriesVariables,
  TransactionHistories_transactionHistories,
} from '@queries/squeeth/__generated__/TransactionHistories'
import { squeethClient } from '@utils/apollo-client'
import BigNumber from 'bignumber.js'
import { useAtomValue } from 'jotai'
import { addressAtom, networkIdAtom } from 'src/state/wallet/atoms'

export interface TransactionHistory extends TransactionHistories_transactionHistories {
  ethPrice: BigNumber
}

export default function useTransactionHistories() {
  const address = useAtomValue(addressAtom)
  const networkId = useAtomValue(networkIdAtom)

  const { data: { transactionHistories } = {} } = useQuery<TransactionHistories, TransactionHistoriesVariables>(
    TRANSACTION_HISTORIES_QUERY,
    {
      variables: { ownerId: address! },
      client: squeethClient[networkId],
      skip: !address,
    },
  )

  return (transactionHistories ?? []) as TransactionHistory[]
}
