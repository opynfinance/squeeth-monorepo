import { useAtomValue } from 'jotai'
import { NextSeo } from 'next-seo'

import ConnectWallet from '@pages/positions/ConnectWallet'
import Positions from '@pages/positions/Positions'
import { useInitCrabMigration } from 'src/state/crabMigration/hooks'
import { addressAtom, supportedNetworkAtom } from 'src/state/wallet/atoms'
import { SQUEETH_BASE_URL } from 'src/constants/index'

const PositionsPage = () => {
  const address = useAtomValue(addressAtom)
  const supportedNetwork = useAtomValue(supportedNetworkAtom)
  useInitCrabMigration()

  if (address && supportedNetwork) return <Positions />

  return (
    <>
      <NextSeo
        title="Squeeth"
        description="Squeeth is a new financial primitive in DeFi that gives traders exposure to ETH²"
        canonical={SQUEETH_BASE_URL}
        openGraph={{
          images: [
            {
              url: SQUEETH_BASE_URL + '/images/squeeth-og-image.png',
              width: 1200,
              height: 630,
              alt: 'Squeeth',
            },
          ],
        }}
        twitter={{
          handle: '@opyn_',
          site: '@opyn_',
          cardType: 'summary_large_image',
        }}
      />

      <ConnectWallet />
    </>
  )
}

export default PositionsPage
