import ConnectWallet from '@pages/positions/ConnectWallet'
import Positions from '@pages/positions/Positions'
import { useAtomValue } from 'jotai'
import { addressAtom } from 'src/state/wallet/atoms'

const PositionsPage = () => {
  const address = useAtomValue(addressAtom)

  if (address) return <Positions />

  return <ConnectWallet />
}

export default PositionsPage
