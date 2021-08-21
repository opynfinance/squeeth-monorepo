import { useMemo } from 'react'

import { CONTROLLER, VAULT_MANAGER, WSQUEETH, ZERO_ADDR } from '../constants/address'
import { useWallet } from '../context/wallet'

const useAddresses = () => {
  const { networkId } = useWallet()

  const state = useMemo(
    () => ({
      zero: ZERO_ADDR,
      controller: CONTROLLER[networkId],
      vaultManager: VAULT_MANAGER[networkId],
      wSqueeth: WSQUEETH[networkId],
    }),
    [networkId],
  )

  return state
}

export { useAddresses }
