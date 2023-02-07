import { Typography } from '@material-ui/core'
import { useAtomValue } from 'jotai'

import { PositionType } from 'src/types'
import { useVaultLiquidations } from '@hooks/contracts/useLiquidations'
import { useCrabPosition } from '@hooks/useCrabPosition'
import { addressAtom } from '@state/wallet/atoms'
import {
  useComputeSwaps,
  useFirstValidVault,
  useLpDebt,
  useMintedDebt,
  useShortDebt,
  usePositionsAndFeesComputation,
} from '@state/positions/hooks'
import { positionTypeAtom } from '@state/positions/atoms'
import useAppMemo from '@hooks/useAppMemo'
import ShortSqueethLiquidated from './ShortSqueethLiquidated'
import {
  useCurrentCrabPositionValue,
  useCurrentCrabPositionValueV2,
  useSetStrategyData,
  useSetStrategyDataV2,
} from '@state/crab/hooks'
import { pnl, pnlInPerct, pnlv2, pnlInPerctv2 } from 'src/lib/pnl'
import { useCrabPositionV2 } from '@hooks/useCrabPosition/useCrabPosition'
import useAppEffect from '@hooks/useAppEffect'
import { crabQueuedInUsdAtom } from '@state/crab/atoms'
import { useBullPosition } from '@hooks/useBullPosition'
import { useInitBullStrategy } from '@state/bull/hooks'
import CrabPosition from './CrabPosition'
import CrabPositionV2 from './CrabPositionV2'
import LongSqueeth from './LongSqueeth'
import ShortSqueeth from './ShortSqueeth'
import LPedSqueeth from './LPedSqueeth'
import MintedSqueeth from './MintedSqueeth'
import BullPosition from './BullPosition'

const Positions: React.FC = () => {
  const address = useAtomValue(addressAtom)
  const positionType = useAtomValue(positionTypeAtom)

  const { squeethAmount } = useComputeSwaps()
  const { validVault: vault, vaultId } = useFirstValidVault()
  const lpedSqueeth = useLpDebt()
  const mintedDebt = useMintedDebt()
  const shortDebt = useShortDebt()
  const setStrategyDataV2 = useSetStrategyDataV2()
  const setStrategyData = useSetStrategyData()
  const crabV2QueuedInUsd = useAtomValue(crabQueuedInUsdAtom)
  useInitBullStrategy()
  useBullPosition(address ?? '')

  useAppEffect(() => {
    setStrategyDataV2()
    setStrategyData()
  }, [setStrategyData, setStrategyDataV2])

  usePositionsAndFeesComputation()
  const { depositedEth, depositedUsd, loading: isCrabPositonLoading } = useCrabPosition(address || '')
  const { currentCrabPositionValue, currentCrabPositionValueInETH, isCrabPositionValueLoading } =
    useCurrentCrabPositionValue()

  const {
    depositedEth: depositedEthV2,
    depositedUsd: depositedUsdV2,
    loading: isCrabPositonLoadingV2,
  } = useCrabPositionV2(address || '')
  const {
    currentCrabPositionValue: currentCrabPositionValueV2,
    currentCrabPositionValueInETH: currentCrabPositionValueInETHV2,
    isCrabPositionValueLoading: isCrabPositionValueLoadingV2,
  } = useCurrentCrabPositionValueV2()

  const isCrabloading = useAppMemo(() => {
    return isCrabPositonLoading || isCrabPositionValueLoading
  }, [isCrabPositonLoading, isCrabPositionValueLoading])

  const isCrabV2loading = useAppMemo(() => {
    return isCrabPositonLoadingV2 || isCrabPositionValueLoadingV2
  }, [isCrabPositonLoadingV2, isCrabPositionValueLoadingV2])

  const pnlWMidPriceInUSD = useAppMemo(() => {
    return pnl(currentCrabPositionValue, depositedUsd)
  }, [currentCrabPositionValue, depositedUsd])
  const pnlWMidPriceInPerct = useAppMemo(() => {
    return pnlInPerct(currentCrabPositionValue, depositedUsd)
  }, [currentCrabPositionValue, depositedUsd])
  const pnlWMidPriceInUSDV2 = useAppMemo(() => {
    return pnlv2(currentCrabPositionValueV2.plus(crabV2QueuedInUsd), depositedUsdV2)
  }, [currentCrabPositionValueV2, depositedUsdV2, crabV2QueuedInUsd])
  const pnlWMidPriceInPerctV2 = useAppMemo(() => {
    return pnlInPerctv2(currentCrabPositionValueV2.plus(crabV2QueuedInUsd), depositedUsdV2)
  }, [currentCrabPositionValueV2, depositedUsdV2, crabV2QueuedInUsd])

  const vaultExists = useAppMemo(() => {
    return Boolean(vault && vault.collateralAmount?.isGreaterThan(0))
  }, [vault])

  const { liquidations } = useVaultLiquidations(Number(vaultId))

  const fullyLiquidated = useAppMemo(() => {
    return vault && vault.shortAmount?.isZero() && liquidations.length > 0
  }, [vault, liquidations?.length])

  const isLoadingPositions = isCrabloading || isCrabV2loading

  if (
    shortDebt.isZero() &&
    depositedEth.isZero() &&
    depositedEthV2.isZero() &&
    squeethAmount.isZero() &&
    mintedDebt.isZero() &&
    lpedSqueeth.isZero()
  ) {
    return <Typography variant="body1">{isLoadingPositions ? 'loading...' : 'No active position'}</Typography>
  }

  return (
    <>
      {positionType === PositionType.LONG && <LongSqueeth />}

      {positionType === PositionType.SHORT && <ShortSqueeth />}

      {lpedSqueeth.isGreaterThan(0) && !fullyLiquidated && <LPedSqueeth vaultExists={vaultExists} />}

      {mintedDebt.isGreaterThan(0) && !fullyLiquidated && <MintedSqueeth vaultExists={vaultExists} />}

      {liquidations.length > 0 && <ShortSqueethLiquidated />}

      {!!address && currentCrabPositionValueInETH.isGreaterThan(0) && (
        <CrabPosition
          depositedEth={depositedEth}
          depositedUsd={depositedUsd}
          loading={isCrabloading}
          pnlWMidPriceInUSD={pnlWMidPriceInUSD}
          pnlWMidPriceInPerct={pnlWMidPriceInPerct}
          currentCrabPositionValue={currentCrabPositionValue}
          currentCrabPositionValueInETH={currentCrabPositionValueInETH}
          version="Crab Strategy v1"
        />
      )}

      {!!address && currentCrabPositionValueInETHV2.isGreaterThan(0) && (
        <CrabPositionV2
          address={address}
          depositedEth={depositedEthV2}
          depositedUsd={depositedUsdV2}
          loading={isCrabV2loading}
          pnlWMidPriceInUSD={pnlWMidPriceInUSDV2}
          pnlWMidPriceInPerct={pnlWMidPriceInPerctV2}
          currentCrabPositionValue={currentCrabPositionValueV2}
          currentCrabPositionValueInETH={currentCrabPositionValueInETHV2}
          version="Crab Strategy v2"
        />
      )}

      {!!address ? <BullPosition /> : null}
    </>
  )
}

export default Positions
