import { useMemo } from 'react'

import {
  CONTROLLER,
  QUOTER,
  SHORT_HELPER,
  SQUEETH_UNI_POOL,
  SWAP_ROUTER,
  VAULT_MANAGER,
  WETH,
  WSQUEETH,
  ZERO_ADDR,
} from '../constants/address'
import { useWallet } from '../context/wallet'

const useAddresses = () => {
  const { networkId } = useWallet()

  const state = useMemo(
    () => ({
      zero: ZERO_ADDR,
      controller: CONTROLLER[networkId],
      vaultManager: VAULT_MANAGER[networkId],
      wSqueeth: WSQUEETH[networkId],
      weth: WETH[networkId],
      swapRouter: SWAP_ROUTER[networkId],
      squeethPool: SQUEETH_UNI_POOL[networkId],
      quoter: QUOTER[networkId],
      shortHelper: SHORT_HELPER[networkId],
    }),
    [networkId],
  )

  return state
}

export { useAddresses }
