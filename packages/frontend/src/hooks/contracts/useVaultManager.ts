import { useEffect, useState } from 'react'
import { Contract } from 'web3-eth-contract'

import erc20Abi from '../../abis/vaultManager.json'
import { useWallet } from '../../context/wallet'
import { Vault } from '../../types'
import { useAddresses } from '../useAddress'
import useInterval from '../useInterval'
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

  const { address, web3 } = useWallet()
  const { vaultManager, shortHelper } = useAddresses()
  const { getVault } = useController()

  useEffect(() => {
    if (!web3 || !vaultManager) return
    setContract(new web3.eth.Contract(erc20Abi as any, vaultManager))
  }, [web3])

  useEffect(() => {
    updateBalance()
  }, [address, contract])

  async function updateBalance() {
    if (!contract) return
    contract
      .getPastEvents('Transfer', {
        fromBlock: 0, // Should be moved to constant and changed based on network id
        toBlock: 'latest',
      })
      .then(async (events) => {
        const tokens = new Set(
          events
            .filter((event) => event.returnValues.to.toLowerCase() === address?.toLowerCase())
            .map((event) => event.returnValues.tokenId),
        )
        const vaultPromise = Array.from(tokens).map((tokenId) => getVault(tokenId))
        const _vaults = (await Promise.all(vaultPromise)).filter((v) => v?.shortAmount.gt(0))
        console.log(_vaults)

        setVaults(_vaults)
      })
  }

  const getOwner = async (vaultId: number) => {
    if (!contract) return

    return await contract.methods.ownerOf(vaultId).call()
  }

  const isApproved = async (toAddress: string, vaultId: number) => {
    if (!contract) return false

    const approval = await contract.methods.getApproved(vaultId).call()
    console.log(approval, 'hello')
    return toAddress.toLowerCase() === approval.toLowerCase()
  }

  const approve = async (toAddress: string, vaultId: number) => {
    if (!contract) return

    await contract.methods.approve(toAddress, vaultId).send({
      from: address,
    })
  }

  useInterval(updateBalance, refetchIntervalSec * 1000)

  return { vaults, getOwner, approve, isApproved }
}
