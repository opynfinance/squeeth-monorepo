import { useQuery } from '@apollo/client'
import BigNumber from 'bignumber.js'
import { useEffect, useState } from 'react'

import { Vault } from '../types'
import { OSQUEETH_DECIMALS } from '../constants'
import { VAULT_QUERY } from '@queries/squeeth/vaultsQuery'
import { Vault_vault } from '@queries/squeeth/__generated__/Vault'

import { useController } from '@hooks/contracts/useController'
import { squeethClient } from '@utils/apollo-client'
import { toTokenAmount } from '@utils/calculations'
import { useAddress, useConnected, useNetworkId } from 'src/state/wallet/hooks'

export const useVaultData = (vid: number) => {
  const [vault, setVault] = useState<Vault | null>(null)
  const [existingCollatPercent, setExistingCollatPercent] = useState(0)
  const [existingCollat, setExistingCollat] = useState(new BigNumber(0))
  const [existingLiqPrice, setExistingLiqPrice] = useState(new BigNumber(0))
  const [collatPercent, setCollatPercent] = useState(0)
  const [isVaultLoading, setVaultLoading] = useState(true)

  const { getCollatRatioAndLiqPrice, normFactor } = useController()
  const { address } = useAddress()
  const connected = useConnected()
  const { networkId } = useNetworkId()

  const { data, loading: isDataLoading } = useQuery<{ vault: Vault_vault }>(VAULT_QUERY, {
    client: squeethClient[networkId],
    fetchPolicy: 'cache-and-network',
    variables: {
      vaultID: vid,
    },
  })

  const _vault = data?.vault
  const updateVault = () => {
    if (!_vault || !connected) return

    setVault({
      id: Number(_vault.id),
      NFTCollateralId: _vault.NftCollateralId,
      collateralAmount: toTokenAmount(new BigNumber(_vault.collateralAmount), 18),
      shortAmount: toTokenAmount(new BigNumber(_vault.shortAmount), OSQUEETH_DECIMALS),
      operator: _vault.operator,
    })
    setExistingCollat(toTokenAmount(new BigNumber(_vault.collateralAmount), 18))

    getCollatRatioAndLiqPrice(new BigNumber(_vault.collateralAmount), new BigNumber(_vault.shortAmount)).then(
      ({ collateralPercent, liquidationPrice }) => {
        setExistingCollatPercent(collateralPercent)
        setCollatPercent(collateralPercent)
        setExistingLiqPrice(new BigNumber(liquidationPrice))
        setVaultLoading(false)
      },
    )
  }

  useEffect(() => {
    updateVault()
  }, [vid, normFactor.toString(), address, connected, _vault?.id])

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
