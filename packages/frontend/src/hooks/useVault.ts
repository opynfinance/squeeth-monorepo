import { Vault } from '../types'
import { useCallback, useEffect, useState } from 'react'
import { useGetVault } from 'src/state/controller/hooks'

const useVault = (vid: number) => {
  const getVault = useGetVault()
  const [vault, setVault] = useState<Vault>()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getVault(vid).then((v) => {
      setVault(v ?? undefined)
      setLoading(false)
    })
  }, [getVault, vid])

  const updateVault = useCallback(() => {
    getVault(vid).then((v) => setVault(v ?? undefined))
  }, [getVault, vid])

  return { vault, loading, updateVault }
}

export default useVault
