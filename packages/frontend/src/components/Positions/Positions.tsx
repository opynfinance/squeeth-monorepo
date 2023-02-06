import { Box, Tooltip, Typography } from '@material-ui/core'
import InfoIcon from '@material-ui/icons/InfoOutlined'
import { useAtomValue } from 'jotai'

import { LPTable } from '@components/Lp/LPTable'
import History from '@components/Positions/History'
import { PositionType } from 'src/types'
import { Tooltips } from '@constants/index'
import { useVaultLiquidations } from '@hooks/contracts/useLiquidations'
import { toTokenAmount } from '@utils/calculations'
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
import { activePositionsAtom, positionTypeAtom } from '@state/positions/atoms'
import { poolAtom } from '@state/squeethPool/atoms'
import { indexAtom } from '@state/controller/atoms'
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
import { formatCurrency } from '@utils/formatter'
import useStyles from './useStyles'
import CrabPosition from './CrabPosition'
import CrabPositionV2 from './CrabPositionV2'
import YourVaults from './YourVaults'
import LongSqueeth from './LongSqueeth'
import ShortSqueeth from './ShortSqueeth'
import LPedSqueeth from './LPedSqueeth'
import MintedSqueeth from './MintedSqueeth'
import BullPosition from './BullPosition'

export default function Positions() {
  const classes = useStyles()
  const pool = useAtomValue(poolAtom)
  const address = useAtomValue(addressAtom)
  const positionType = useAtomValue(positionTypeAtom)
  const activePositions = useAtomValue(activePositionsAtom)

  const { squeethAmount } = useComputeSwaps()
  const { validVault: vault, vaultId } = useFirstValidVault()
  const lpedSqueeth = useLpDebt()
  const mintedDebt = useMintedDebt()
  const shortDebt = useShortDebt()
  const index = useAtomValue(indexAtom)
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

  const ethPrice = toTokenAmount(index, 18).sqrt()

  return (
    <div>
      <div className={classes.container}>
        <div className={classes.header}>
          <Typography variant="h4" className={classes.sectionTitle}>
            Your Positions
          </Typography>
          <div className={classes.ethPriceContainer}>
            <Typography component="span" color="textSecondary">
              ETH Price:
            </Typography>

            <div className={classes.tooltipContainer}>
              <Typography component="span" className={classes.textMonospace}>
                {formatCurrency(ethPrice.toNumber())}
              </Typography>
              <Tooltip title={Tooltips.SpotPrice}>
                <InfoIcon className={classes.infoIcon} />
              </Tooltip>
            </div>
          </div>
        </div>

        {shortDebt.isZero() &&
        depositedEth.isZero() &&
        depositedEthV2.isZero() &&
        squeethAmount.isZero() &&
        mintedDebt.isZero() &&
        lpedSqueeth.isZero() ? (
          <div className={classes.empty}>
            <Typography>No active positions</Typography>
          </div>
        ) : null}

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

        {activePositions?.length > 0 && (
          <>
            <div className={classes.header}>
              <Typography variant="h4" className={classes.sectionTitle}>
                Your LP Positions
              </Typography>
            </div>
            <LPTable isLPage={false} pool={pool!} />
          </>
        )}

        <Box mt={8} component="section">
          <Typography variant="h4" className={classes.sectionTitle}>
            Your Vaults
          </Typography>
          <Box mt={2}>
            <YourVaults />
          </Box>
        </Box>

        <div className={classes.history}>
          <Typography variant="h4" className={classes.sectionTitle}>
            Transaction History
          </Typography>
          <History />
        </div>
      </div>
    </div>
  )
}
