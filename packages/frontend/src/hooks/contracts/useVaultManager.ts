import { useQuery } from '@apollo/client'
import { useEffect, useState } from 'react'
import { Contract } from 'web3-eth-contract'

import erc721Abi from '../../abis/vaultManager.json'
import { VAULTS_QUERY } from '../../queries/squeeth/vaultsQuery'
import { Vaults, Vaults_vaults } from '../../queries/squeeth/__generated__/Vaults'
import { squeethClient } from '../../utils/apollo-client'
import { useWallet } from '@context/wallet'
import { useAddresses } from '../useAddress'
// import useInterval from '../useInterval'
import { useController } from './useController'

/**
 * get user vaults.
 * @param token token address
 * @param refetchIntervalSec refetch interval in seconds
 * @returns {Vault[]}
 */
export const useVaultManager = (refetchIntervalSec = 20) => {
  const [vaults, setVaults] = useState<Array<any>>([])
  const [contract, setContract] = useState<Contract>()

  const { address, web3, handleTransaction } = useWallet()
  const { vaultManager, shortHelper } = useAddresses()
  const { getVault } = useController()

  useEffect(() => {
    if (!web3 || !vaultManager) return
    setContract(new web3.eth.Contract(erc721Abi as any, vaultManager))
  }, [web3])

  const { data, loading } = useQuery<Vaults>(VAULTS_QUERY, {
    client: squeethClient,
    fetchPolicy: 'cache-and-network',
    variables: {
      ownerId: address,
    },
  })

  useEffect(() => {
    ;(async function updateBalance() {
      if (!data?.vaults?.length) return
      const tokens = new Set(data?.vaults.map((vault: Vaults_vaults) => vault.id))

      const vaultPromise = Array.from(tokens).map((tokenId) => getVault(Number(tokenId)))
      const _vaults = (await Promise.all(vaultPromise)).filter((v) => {
        return v?.shortAmount.gt(0)
      })

      setVaults(_vaults)
    })()
  }, [data?.vaults])

  const getOwner = async (vaultId: number) => {
    if (!contract) return

    return await contract.methods.ownerOf(vaultId).call()
  }

  const isApproved = async (toAddress: string, vaultId: number) => {
    if (!contract) return false

    const approval = await contract.methods.getApproved(vaultId).call()
    return toAddress.toLowerCase() === approval.toLowerCase()
  }

  const approve = async (toAddress: string, vaultId: number) => {
    if (!contract) return

    await handleTransaction(
      contract.methods.approve(toAddress, vaultId).send({
        from: address,
      }),
    )
  }

  return { vaults, getOwner, approve, isApproved, loading }
}
