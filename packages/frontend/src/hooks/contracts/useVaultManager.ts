import { useQuery } from '@apollo/client'
import BigNumber from 'bignumber.js'
import { useEffect, useState } from 'react'
// import { Contract } from 'web3-eth-contract'

import { toTokenAmount } from '@utils/calculations'
// import erc721Abi from '../../abis/vaultManager.json'
import { OSQUEETH_DECIMALS } from '../../constants/'
import { VAULTS_QUERY, VAULTS_SUBSCRIPTION } from '../../queries/squeeth/vaultsQuery'
import { Vaults } from '../../queries/squeeth/__generated__/Vaults'
import { squeethClient } from '../../utils/apollo-client'
import { useWallet } from '@context/wallet'
// import { useAddresses } from '../useAddress'

/**
 * get user vaults.
 * @param token token address
 * @param refetchIntervalSec refetch interval in seconds
 * @returns {Vault[]}
 */
export const useVaultManager = () => {
  const [vaults, setVaults] = useState<Array<any>>([])
  // const [contract, setContract] = useState<Contract>()

  const { address, networkId } = useWallet()
  // const { vaultManager } = useAddresses()

  // useEffect(() => {
  //   if (!web3 || !vaultManager) return
  //   setContract(new web3.eth.Contract(erc721Abi as any, vaultManager))
  // }, [vaultManager, web3])

  const { data, loading, subscribeToMore } = useQuery<Vaults>(VAULTS_QUERY, {
    client: squeethClient[networkId],
    fetchPolicy: 'cache-and-network',
    variables: {
      ownerId: address?.toLowerCase() ?? '',
    },
  })
  useEffect(() => {
    subscribeToMore({
      document: VAULTS_SUBSCRIPTION,
      variables: {
        ownerId: address?.toLowerCase() ?? '',
      },
      updateQuery(prev, { subscriptionData }) {
        if (!subscriptionData.data) return prev
        const newVaults = subscriptionData.data.vaults
        return { vaults: newVaults }
      },
    })
  }, [address, subscribeToMore])

  useEffect(() => {
    ;(async () => {
      if (!data?.vaults?.length) return

      const _vaults = data?.vaults
        .filter((v) => {
          return new BigNumber(v?.collateralAmount ?? 0).gt(0)
        })
        .map(({ id, NftCollateralId, collateralAmount, shortAmount, operator }) => ({
          id,
          NFTCollateralId: NftCollateralId,
          collateralAmount: toTokenAmount(new BigNumber(collateralAmount), 18),
          shortAmount: toTokenAmount(new BigNumber(shortAmount), OSQUEETH_DECIMALS),
          operator,
        }))

      setVaults(_vaults)
    })()
  }, [data?.vaults?.length])

  // const getOwner = async (vaultId: number) => {
  //   if (!contract) return

  //   return await contract.methods.ownerOf(vaultId).call()
  // }

  // const isApproved = async (toAddress: string, vaultId: number) => {
  //   if (!contract) return false

  //   const approval = await contract.methods.getApproved(vaultId).call()
  //   return toAddress?.toLowerCase() === approval?.toLowerCase()
  // }

  // const approve = async (toAddress: string, vaultId: number) => {
  //   if (!contract) return

  //   await handleTransaction(
  //     contract.methods.approve(toAddress, vaultId).send({
  //       from: address,
  //     }),
  //   )
  // }

  return { vaults, loading }
}
