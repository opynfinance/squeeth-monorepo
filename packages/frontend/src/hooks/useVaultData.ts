import BigNumber from 'bignumber.js'
import { useEffect, useState } from 'react'
import { useAtomValue } from 'jotai'

import { Vault } from '../types'
import { addressAtom, connectedWalletAtom } from 'src/state/wallet/atoms'
import { readyAtom } from 'src/state/squeethPool/atoms'
import { normFactorAtom } from 'src/state/controller/atoms'
import { useGetCollatRatioAndLiqPrice, useGetVault } from 'src/state/controller/hooks'

export const useVaultData = (vid: number) => {
  const [vault, setVault] = useState<Vault | null>(null)
  const [existingCollatPercent, setExistingCollatPercent] = useState(0)
  const [existingCollat, setExistingCollat] = useState(new BigNumber(0))
  const [existingLiqPrice, setExistingLiqPrice] = useState(new BigNumber(0))
  const [collatPercent, setCollatPercent] = useState(0)
  const [isVaultLoading, setVaultLoading] = useState(true)

  const normFactor = useAtomValue(normFactorAtom)
  const getVault = useGetVault()
  const getCollatRatioAndLiqPrice = useGetCollatRatioAndLiqPrice()
  const ready = useAtomValue(readyAtom)
  // const { address, connected } = useWallet()
  const connected = useAtomValue(connectedWalletAtom)
  const address = useAtomValue(addressAtom)

  const updateVault = async () => {
    if (!connected || !ready) return

    const _vault = await getVault(vid)

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
  }

  useEffect(() => {
    updateVault()
  }, [vid, normFactor.toString(), address, connected, ready])

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
