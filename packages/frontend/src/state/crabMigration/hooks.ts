import useAppCallback from '@hooks/useAppCallback'
import { fromTokenAmount, toTokenAmount } from '@utils/calculations'
import BigNumber from 'bignumber.js'
import { useAtomValue, useSetAtom } from 'jotai'
import { useCallback, useEffect } from 'react'
import { crabMigrationContractAtom } from '../contracts/atoms'
import { addressAtom } from '../wallet/atoms'
import { useHandleTransaction } from '../wallet/hooks'
import { totalMigratedSharesAtom, userMigratedSharesAtom } from './atom'

export const useInitCrabMigration = () => {
  const address = useAtomValue(addressAtom)
  const crabMigrationContract = useAtomValue(crabMigrationContractAtom)
  const setTotalMigratedShares = useSetAtom(totalMigratedSharesAtom)
  const setUserMigratedShares = useSetAtom(userMigratedSharesAtom)

  const updateMigrationData = useCallback(async () => {
    const p1 = crabMigrationContract?.methods.totalCrabV1SharesMigrated().call()
    const p2 = crabMigrationContract?.methods.sharesDeposited(address).call()
    const [_totalShare, _userShare] = await Promise.all([p1, p2])
    setTotalMigratedShares(toTokenAmount(_totalShare, 18))
    setUserMigratedShares(toTokenAmount(_userShare, 18))
  }, [address, crabMigrationContract?.methods, setTotalMigratedShares, setUserMigratedShares])

  useEffect(() => {
    updateMigrationData()
  }, [updateMigrationData])
}

/**
 * Calls depositV1Shares function in migration contract. CrabV1 should be approved to migration contract by the user
 * @param amount Amount of v1 shares to deposit
 * @returns function to migrate
 */
export const useQueueMigrate = () => {
  const address = useAtomValue(addressAtom)
  const crabMigrationContract = useAtomValue(crabMigrationContractAtom)
  const handleTransaction = useHandleTransaction()
  const setTotalMigratedShares = useSetAtom(totalMigratedSharesAtom)
  const setUserMigratedShares = useSetAtom(userMigratedSharesAtom)

  const queueMigrate = useAppCallback(
    async (amount: BigNumber | string) => {
      const res = await handleTransaction(
        crabMigrationContract?.methods.depositV1Shares(fromTokenAmount(amount, 18).toFixed(0)).send({
          from: address,
        }),
      )

      const p1 = crabMigrationContract?.methods.totalCrabV1SharesMigrated().call()
      const p2 = crabMigrationContract?.methods.sharesDeposited(address).call()
      const [_totalShare, _userShare] = await Promise.all([p1, p2])
      setTotalMigratedShares(toTokenAmount(_totalShare, 18))
      setUserMigratedShares(toTokenAmount(_userShare, 18))

      return res
    },
    [address, crabMigrationContract?.methods, handleTransaction, setTotalMigratedShares, setUserMigratedShares],
  )

  return queueMigrate
}
