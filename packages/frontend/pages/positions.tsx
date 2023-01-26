import { useAtomValue } from 'jotai'

import ConnectWallet from '@pages/positions/ConnectWallet'
import Positions from '@pages/positions/Positions'
import { useInitCrabMigration } from 'src/state/crabMigration/hooks'
import { addressAtom, supportedNetworkAtom } from 'src/state/wallet/atoms'
import DefaultSiteSeo from '@components/DefaultSiteSeo/DefaultSiteSeo'

const PositionsPage = () => {
  const address = useAtomValue(addressAtom)
  const supportedNetwork = useAtomValue(supportedNetworkAtom)
  useInitCrabMigration()

  if (address && supportedNetwork) return <Positions />

  return (
    <>
      <DefaultSiteSeo />
      <ConnectWallet />
    </>
  )
}

export default PositionsPage
