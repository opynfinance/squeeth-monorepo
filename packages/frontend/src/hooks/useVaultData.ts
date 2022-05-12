import BigNumber from 'bignumber.js'
import { useAtom } from 'jotai'
import { useState } from 'react'

import { useGetCollatRatioAndLiqPrice } from 'src/state/controller/hooks'
import { collatPercentAtom, existingCollatPercentAtom, existingLiqPriceAtom } from 'src/state/positions/atoms'
import useAppEffect from './useAppEffect'

interface IVault {
  id: string
  NFTCollateralId: any
  collateralAmount: BigNumber
  shortAmount: BigNumber
  operator: any
}

export const useVaultData = (vault: IVault | undefined) => {
  const [existingCollatPercent, setExistingCollatPercent] = useAtom(existingCollatPercentAtom)
  const [existingCollat, setExistingCollat] = useState(new BigNumber(0))
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
