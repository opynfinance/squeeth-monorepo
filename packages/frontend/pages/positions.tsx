import ConnectWallet from '@pages/positions/ConnectWallet'
import Positions from '@pages/positions/Positions'
import { useAtomValue } from 'jotai'
import { useInitCrabMigration } from 'src/state/crabMigration/hooks'
import { addressAtom, supportedNetworkAtom } from 'src/state/wallet/atoms'

const PositionsPage = () => {
  const address = useAtomValue(addressAtom)
  const supportedNetwork = useAtomValue(supportedNetworkAtom)
  useInitCrabMigration()

  if (address && supportedNetwork) return <Positions />

  return <ConnectWallet />
}

export default PositionsPage
