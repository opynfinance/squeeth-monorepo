import ConnectWallet from '@pages/positions/ConnectWallet'
import Positions from '@pages/positions/Positions'
import { useAtomValue } from 'jotai'
import { addressAtom, supportedNetworkAtom } from 'src/state/wallet/atoms'

const PositionsPage = () => {
  const address = useAtomValue(addressAtom)
  const supportedNetwork = useAtomValue(supportedNetworkAtom)

  if (address && supportedNetwork)
    return (
      <>
        <Positions />
      </>
    )

  return <ConnectWallet />
}

export default PositionsPage
