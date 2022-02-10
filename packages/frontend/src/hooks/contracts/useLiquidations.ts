import { useQuery } from '@apollo/client'
import { useEffect, useState } from 'react'
import { Contract } from 'web3-eth-contract'

import controllerABI from '../../abis/controller.json'
import { OSQUEETH_DECIMALS } from '../../constants'
import { liquidations } from '../../queries/squeeth/__generated__/liquidations'
import { LIQUIDATIONS_QUERY } from '../../queries/squeeth/liquidationsQuery'
import { squeethClient } from '../../utils/apollo-client'
import { toTokenAmount } from '@utils/calculations'
import { useAddresses } from '../useAddress'
import useAppSelector from '@hooks/useAppSelector'
import { useNetworkId } from 'src/state/wallet/hooks'

/**
 * get vault liquidations.
 * @param vaultId
 * @param refetchIntervalSec refetch interval in seconds
 * @returns {Vault[]}
 */
export const useVaultLiquidations = (vaultId: number, refetchIntervalSec = 30) => {
  const [liquidations, setLiquidations] = useState<Array<any>>([])
  const [contract, setContract] = useState<Contract>()

  const web3 = useAppSelector(({ wallet }) => wallet.web3)
  const { networkId } = useNetworkId()
  const { controller } = useAddresses()

  useEffect(() => {
    if (!web3 || !controller) return
    setContract(new web3.eth.Contract(controllerABI as any, controller))
  }, [web3])

  const { data, loading } = useQuery<liquidations>(LIQUIDATIONS_QUERY, {
    client: squeethClient[networkId],
    variables: {
      vaultId,
    },
    fetchPolicy: 'cache-and-network',
  })

  useEffect(() => {
    if (!data?.liquidations) return
    const _liquidations = data?.liquidations.map((l) => {
      return {
        ...l,
        debtAmount: toTokenAmount(l.debtAmount.toString(), OSQUEETH_DECIMALS),
        collateralPaid: toTokenAmount(l.collateralPaid.toString(), 18),
      }
    })
    setLiquidations(_liquidations)
  }, [data?.liquidations?.length])

  return { liquidations, loading }
}
