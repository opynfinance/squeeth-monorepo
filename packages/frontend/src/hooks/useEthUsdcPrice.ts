import { TWAP_PERIOD } from '../constants'
import { useAtomValue } from 'jotai'
import { addressesAtom } from 'src/state/positions/atoms'
import useTwap from './contracts/useTwap'

export default function useEthUsdcPrice() {
  const { ethUsdcPool, weth, usdc } = useAtomValue(addressesAtom)
  return useTwap(ethUsdcPool, weth, usdc, TWAP_PERIOD)
}
