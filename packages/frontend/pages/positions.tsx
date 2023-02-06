import { useAtomValue } from 'jotai'

import ConnectWallet from '@components/Positions/ConnectWallet'
import Positions from '@components/Positions/Positions'
import { useInitCrabMigration } from 'src/state/crabMigration/hooks'
import { addressAtom, supportedNetworkAtom } from 'src/state/wallet/atoms'
import DefaultSiteSeo from '@components/DefaultSiteSeo/DefaultSiteSeo'

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
      <PositionsPage />
    </>
  )
}

export default Wrapper
