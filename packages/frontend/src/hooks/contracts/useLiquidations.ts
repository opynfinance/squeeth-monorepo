import { useEffect, useState } from 'react'
import { Contract } from 'web3-eth-contract'

import controllerABI from '../../abis/controller.json'
import { WSQUEETH_DECIMALS } from '../../constants'
import { useWallet } from '@context/wallet'
import { toTokenAmount } from '@utils/calculations'
import { useAddresses } from '../useAddress'
import useInterval from '../useInterval'

/**
 * get vault liquidations.
 * @param vaultId
 * @param refetchIntervalSec refetch interval in seconds
 * @returns {Vault[]}
 */
export const useVaultLiquidations = (vaultId: number, refetchIntervalSec = 20) => {
  const [liquidations, setLiquidations] = useState<Array<any>>([])
  const [contract, setContract] = useState<Contract>()

  const { address, web3 } = useWallet()
  const { controller } = useAddresses()
  // const { getVault } = useController()

  useEffect(() => {
    if (!web3 || !controller) return
    setContract(new web3.eth.Contract(controllerABI as any, controller))
  }, [web3])

  useEffect(() => {
    updateData()
  }, [address, contract, vaultId])

  async function updateData() {
    if (!contract) return
    try {
      contract
        .getPastEvents('Liquidate', {
          fromBlock: 0, // Should be moved to constant and changed based on network id
          toBlock: 'latest',
        })
        .then(async (events) => {
          const _liquidations = events
            .filter((event) => Number(event.returnValues.vaultId) === vaultId)
            .map((l) => {
              return {
                ...l.returnValues,
                debtAmount: toTokenAmount(l.returnValues.debtAmount, WSQUEETH_DECIMALS),
                collateralPaid: toTokenAmount(l.returnValues.collateralPaid, 18),
              }
            })
          setLiquidations(_liquidations)
        })
    } catch (error) {
      console.log(`updateData error`)
    }
  }

  useInterval(updateData, refetchIntervalSec * 1000)

  return { liquidations }
}
