import { Vault } from '../types'
import { useEffect, useState } from 'react'
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

  return { vault, loading }
}

export default useVault
