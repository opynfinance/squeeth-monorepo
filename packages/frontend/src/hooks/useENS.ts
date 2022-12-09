import { useAtomValue } from 'jotai'
import { useEffect, useState } from 'react'
import { web3Atom } from 'src/state/wallet/atoms'
import { ethers } from 'ethers'

export function useENS(address: string | null | undefined) {
  const [ensName, setENSName] = useState<string | null>()
  const web3 = useAtomValue(web3Atom)

  useEffect(() => {
    async function resolveENS() {
      if (address && web3.currentProvider) {
        const provider = new ethers.providers.Web3Provider(web3.currentProvider as any)
        const name = await provider.lookupAddress(address)
        if (name) setENSName(name)
      }
    }
    resolveENS()
  }, [address, web3])

  return { ensName }
}
