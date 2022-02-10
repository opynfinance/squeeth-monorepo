import { useQuery } from '@apollo/client'
import BigNumber from 'bignumber.js'
import { useEffect, useState } from 'react'
import { useAtom } from 'jotai'

import { Vault } from '../types'
import { OSQUEETH_DECIMALS } from '../constants'
import { VAULT_QUERY } from '@queries/squeeth/vaultsQuery'
import { Vault_vault } from '@queries/squeeth/__generated__/Vault'

import { useWallet } from '@context/wallet'
import { useController, normFactorAtom } from '@hooks/contracts/useController'
import { squeethClient } from '@utils/apollo-client'
import { toTokenAmount } from '@utils/calculations'
import { useSqueethPool } from './contracts/useSqueethPool'

export const useVaultData = (vid: number) => {
  const [vault, setVault] = useState<Vault | null>(null)
  const [existingCollatPercent, setExistingCollatPercent] = useState(0)
  const [existingCollat, setExistingCollat] = useState(new BigNumber(0))
  const [existingLiqPrice, setExistingLiqPrice] = useState(new BigNumber(0))
  const [collatPercent, setCollatPercent] = useState(0)
  const [isVaultLoading, setVaultLoading] = useState(true)

  const { getCollatRatioAndLiqPrice } = useController()
  const normFactor = useAtom(normFactorAtom)[0]
  const { ready } = useSqueethPool()
  const { address, connected, networkId } = useWallet()

  const { data, loading: isDataLoading } = useQuery<{ vault: Vault_vault }>(VAULT_QUERY, {
    client: squeethClient[networkId],
    fetchPolicy: 'cache-and-network',
    variables: {
      vaultID: vid,
    },
  })

  const _vault = data?.vault
  const updateVault = () => {
    if (!_vault || !connected || !ready) return

    setVault({
      id: Number(_vault.id),
      NFTCollateralId: _vault.NftCollateralId,
      collateralAmount: toTokenAmount(new BigNumber(_vault.collateralAmount), 18),
      shortAmount: toTokenAmount(new BigNumber(_vault.shortAmount), OSQUEETH_DECIMALS),
      operator: _vault.operator,
    })
    setExistingCollat(toTokenAmount(new BigNumber(_vault.collateralAmount), 18))

    getCollatRatioAndLiqPrice(
      toTokenAmount(new BigNumber(_vault.collateralAmount), 18),
      toTokenAmount(new BigNumber(_vault.shortAmount), OSQUEETH_DECIMALS),
      _vault.NftCollateralId ? Number(_vault.NftCollateralId) : undefined,
    ).then(({ collateralPercent, liquidationPrice }) => {
      setExistingCollatPercent(collateralPercent)
      setCollatPercent(collateralPercent)
      setExistingLiqPrice(new BigNumber(liquidationPrice))
      setVaultLoading(false)
    })
  }

  useEffect(() => {
    updateVault()
  }, [vid, normFactor.toString(), address, connected, _vault?.id, ready])

  return {
    vault,
    existingCollatPercent,
    existingLiqPrice,
    updateVault,
    setCollatPercent,
    collatPercent,
    isVaultLoading: isVaultLoading || isDataLoading,
    setVaultLoading,
    existingCollat,
  }
}
