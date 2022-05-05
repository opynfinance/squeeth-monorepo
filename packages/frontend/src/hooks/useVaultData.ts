import BigNumber from 'bignumber.js'
import { useState } from 'react'
import { useAtom, useAtomValue } from 'jotai'
import { useUpdateAtom } from 'jotai/utils'

import { addressAtom, connectedWalletAtom } from 'src/state/wallet/atoms'
import { readyAtom } from 'src/state/squeethPool/atoms'
import { useGetCollatRatioAndLiqPrice, useGetVault } from 'src/state/controller/hooks'
import {
  collatPercentAtom,
  existingCollatAtom,
  existingCollatPercentAtom,
  existingLiqPriceAtom,
  vaultAtom,
  vaultManagerPollingAtom,
} from 'src/state/positions/atoms'
import useAppEffect from './useAppEffect'
import useAppCallback from './useAppCallback'

export const useVaultData = (vid: number) => {
  const [vault, setVault] = useAtom(vaultAtom)
  const [existingCollatPercent, setExistingCollatPercent] = useAtom(existingCollatPercentAtom)
  const [existingCollat, setExistingCollat] = useAtom(existingCollatAtom)
  const [existingLiqPrice, setExistingLiqPrice] = useAtom(existingLiqPriceAtom)
  const [collatPercent, setCollatPercent] = useAtom(collatPercentAtom)
  const [isVaultLoading, setVaultLoading] = useState(true)

  // const normFactor = useAtomValue(normFactorAtom)
  const getVault = useGetVault()
  const getCollatRatioAndLiqPrice = useGetCollatRatioAndLiqPrice()
  const ready = useAtomValue(readyAtom)
  const connected = useAtomValue(connectedWalletAtom)
  const setVaultManagerPolling = useUpdateAtom(vaultManagerPollingAtom)
  // const address = useAtomValue(addressAtom)

  const updateVault = useAppCallback(async () => {
    if (!connected || !ready) return

    const _vault = await getVault(vid)
    setVaultManagerPolling(true)

    if (!_vault) return

    setVault(_vault)
    setExistingCollat(_vault.collateralAmount)

    getCollatRatioAndLiqPrice(
      _vault.collateralAmount,
      _vault.shortAmount,
      _vault.NFTCollateralId ? Number(_vault.NFTCollateralId) : undefined,
    ).then(({ collateralPercent, liquidationPrice }) => {
      setExistingCollatPercent(collateralPercent)
      setCollatPercent(collateralPercent)
      setExistingLiqPrice(new BigNumber(liquidationPrice))
      setVaultLoading(false)
    })
  }, [
    connected,
    getCollatRatioAndLiqPrice,
    getVault,
    ready,
    setCollatPercent,
    setExistingCollat,
    setExistingCollatPercent,
    setExistingLiqPrice,
    setVault,
    setVaultManagerPolling,
    vid,
  ])

  useAppEffect(() => {
    updateVault()
  }, [updateVault])

  return {
    vault,
    existingCollatPercent,
    existingLiqPrice,
    updateVault,
    setCollatPercent,
    collatPercent,
    isVaultLoading: isVaultLoading,
    setVaultLoading,
    existingCollat,
  }
}
