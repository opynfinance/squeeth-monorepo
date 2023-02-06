import { useAtomValue } from 'jotai'

import ConnectWallet from '@components/Positions/ConnectWallet'
import Positions from '@components/Positions/Positions'
import { useInitCrabMigration } from '@state/crabMigration/hooks'
import { addressAtom, supportedNetworkAtom } from '@state/wallet/atoms'
import DefaultSiteSeo from '@components/DefaultSiteSeo/DefaultSiteSeo'
import Nav from '@components/Nav'

const PositionsPage = () => {
  const address = useAtomValue(addressAtom)
  const supportedNetwork = useAtomValue(supportedNetworkAtom)
  useInitCrabMigration()

  if (address && supportedNetwork) {
    return <Positions />
  }
  return <ConnectWallet />
}

const Wrapper = () => {
  return (
    <>
      <DefaultSiteSeo />
      <Nav />

      <PositionsPage />
    </>
  )
}

export default Wrapper
