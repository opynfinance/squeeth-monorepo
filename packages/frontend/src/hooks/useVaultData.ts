import BigNumber from 'bignumber.js'
import { useState } from 'react'
import { useAtom, useAtomValue } from 'jotai'

import { addressAtom, connectedWalletAtom } from 'src/state/wallet/atoms'
import { readyAtom } from 'src/state/squeethPool/atoms'
import { useGetCollatRatioAndLiqPrice, useGetVault } from 'src/state/controller/hooks'
import {
  collatPercentAtom,
  existingCollatAtom,
  existingCollatPercentAtom,
  existingLiqPriceAtom,
  vaultAtom,
} from 'src/state/positions/atoms'
// import { normFactorAtom } from 'src/state/controller/atoms'
import useAppEffect from './useAppEffect'
import useAppCallback from './useAppCallback'

interface IVault {
  id: string
  NFTCollateralId: any
  collateralAmount: BigNumber
  shortAmount: BigNumber
  operator: any
}

export const useVaultData = (vault: IVault | undefined) => {
  const [existingCollatPercent, setExistingCollatPercent] = useAtom(existingCollatPercentAtom)
  const [existingCollat, setExistingCollat] = useAtom(existingCollatAtom)
  const [existingLiqPrice, setExistingLiqPrice] = useAtom(existingLiqPriceAtom)
  const [collatPercent, setCollatPercent] = useAtom(collatPercentAtom)

  const getCollatRatioAndLiqPrice = useGetCollatRatioAndLiqPrice()

  useAppEffect(() => {
    if (!vault) {
      setExistingCollat(new BigNumber(0))
      setExistingCollatPercent(0)
      setCollatPercent(0)
      setExistingLiqPrice(new BigNumber(0))
      return
    }

    setExistingCollat(vault.collateralAmount)

    getCollatRatioAndLiqPrice(
      vault.collateralAmount,
      vault.shortAmount,
      vault.NFTCollateralId ? Number(vault.NFTCollateralId) : undefined,
    ).then(({ collateralPercent, liquidationPrice }) => {
      setExistingCollatPercent(collateralPercent)
      setCollatPercent(collateralPercent)
      setExistingLiqPrice(new BigNumber(liquidationPrice))
    })
  }, [
    getCollatRatioAndLiqPrice,
    setCollatPercent,
    setExistingCollat,
    setExistingCollatPercent,
    setExistingLiqPrice,
    vault,
  ])

  return {
    vault,
    existingCollatPercent,
    existingLiqPrice,
    setCollatPercent,
    collatPercent,
    existingCollat,
  }
}
