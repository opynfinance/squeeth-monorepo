import useAppEffect from '@hooks/useAppEffect'
import { useAtomValue } from 'jotai'
import react from 'react'
import { crabMigrationContractAtom } from '../contracts/atoms'
import { addressAtom } from '../wallet/atoms'

const useInitCrabMigration = () => {
  const address = useAtomValue(addressAtom)
  const crabMigrationContract = useAtomValue(crabMigrationContractAtom)
}
