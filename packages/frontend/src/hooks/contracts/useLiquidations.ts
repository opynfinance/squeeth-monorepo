import { useQuery } from '@apollo/client'
import { useState } from 'react'
import { Contract } from 'web3-eth-contract'
import { useAtomValue } from 'jotai'

import controllerABI from '../../abis/controller.json'
import { OSQUEETH_DECIMALS } from '../../constants'
import { liquidations } from '../../queries/squeeth/__generated__/liquidations'
import { LIQUIDATIONS_QUERY } from '../../queries/squeeth/liquidationsQuery'
import { squeethClient } from '../../utils/apollo-client'
import { toTokenAmount } from '@utils/calculations'
import { networkIdAtom /* web3Atom */ } from 'src/state/wallet/atoms'
// import { addressesAtom } from 'src/state/positions/atoms'
import useAppEffect from '@hooks/useAppEffect'

/**
 * get vault liquidations.
 * @param vaultId
 * @param refetchIntervalSec refetch interval in seconds
 * @returns {Vault[]}
 */
export const useVaultLiquidations = (vaultId: number /* refetchIntervalSec = 30 */) => {
  const [liquidations, setLiquidations] = useState<Array<any>>([])
  // const [contract, setContract] = useState<Contract>()

  // const web3 = useAtomValue(web3Atom)
  const networkId = useAtomValue(networkIdAtom)
  // const { controller } = useAtomValue(addressesAtom)

  // useAppEffect(() => {
  //   if (!web3 || !controller) return
  //   setContract(new web3.eth.Contract(controllerABI as any, controller))
  // }, [web3])

  const { data, loading } = useQuery<liquidations>(LIQUIDATIONS_QUERY, {
    client: squeethClient[networkId],
    variables: {
      vaultId,
    },
    fetchPolicy: 'cache-and-network',
  })

  useAppEffect(() => {
    if (!data?.liquidations) return
    const _liquidations = data?.liquidations.map((l) => {
      return {
        ...l,
        debtAmount: toTokenAmount(l.debtAmount.toString(), OSQUEETH_DECIMALS),
        collateralPaid: toTokenAmount(l.collateralPaid.toString(), 18),
      }
    })
    setLiquidations(_liquidations)
  }, [data?.liquidations])

  return { liquidations, loading }
}
