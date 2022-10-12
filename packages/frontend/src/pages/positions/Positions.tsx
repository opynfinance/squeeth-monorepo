import { Box, Tooltip, Typography } from '@material-ui/core'
import FiberManualRecordIcon from '@material-ui/icons/FiberManualRecord'

import clsx from 'clsx'
import { useAtomValue } from 'jotai'

import { LPTable } from '@components/Lp/LPTable'
import Nav from '@components/Nav'
import History from '@pages/positions/History'
import { PositionType } from '../../types'
import { BIG_ZERO, Tooltips } from '../../constants'
import { useVaultLiquidations } from '@hooks/contracts/useLiquidations'
import { toTokenAmount } from '@utils/calculations'
import { useCrabPosition } from '@hooks/useCrabPosition'
import { addressAtom } from 'src/state/wallet/atoms'
import {
  useComputeSwaps,
  useFirstValidVault,
  useLpDebt,
  useMintedDebt,
  useShortDebt,
  usePositionsAndFeesComputation,
} from 'src/state/positions/hooks'
import { activePositionsAtom, positionTypeAtom } from 'src/state/positions/atoms'
import { poolAtom } from 'src/state/squeethPool/atoms'
import { indexAtom } from 'src/state/controller/atoms'
import useAppMemo from '@hooks/useAppMemo'
import useStyles from './useStyles'
import CrabPosition from './CrabPosition'
import YourVaults from './YourVaults'
import LongSqueeth from './LongSqueeth'
import ShortSqueeth from './ShortSqueeth'
import LPedSqueeth from './LPedSqueeth'
import MintedSqueeth from './MintedSqueeth'
import ShortSqueethLiquidated from './ShortSqueethLiquidated'
import {
  useCurrentCrabPositionValue,
  useCurrentCrabPositionValueV2,
  useSetStrategyData,
  useSetStrategyDataV2,
} from 'src/state/crab/hooks'
import { pnl, pnlInPerct, pnlv2, pnlInPerctv2 } from 'src/lib/pnl'
import { useCrabPositionV2 } from '@hooks/useCrabPosition/useCrabPosition'
import CrabPositionV2 from '@components/Strategies/Crab/CrabPositionV2'
import useAppEffect from '@hooks/useAppEffect'

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
    return pnlv2(currentCrabPositionValueV2, depositedUsdV2)
  }, [currentCrabPositionValueV2, depositedUsdV2])
  const pnlWMidPriceInPerctV2 = useAppMemo(() => {
    return pnlInPerctv2(currentCrabPositionValueV2, depositedUsdV2)
  }, [currentCrabPositionValueV2, depositedUsdV2])

  const vaultExists = useAppMemo(() => {
    return Boolean(vault && vault.collateralAmount?.isGreaterThan(0))
  }, [vault])

  const { liquidations } = useVaultLiquidations(Number(vaultId))

  const fullyLiquidated = useAppMemo(() => {
    return vault && vault.shortAmount?.isZero() && liquidations.length > 0
  }, [vault, liquidations?.length])

  return (
    <div>
      <Nav />
      <div className={classes.container}>
        <div className={classes.header}>
          <Typography color="primary" variant="h6">
            Your Positions
          </Typography>
          <div style={{ display: 'flex' }}>
            <Typography component="span" color="textSecondary">
              ETH Price:{' '}
            </Typography>

            <div className={classes.tooltipContainer}>
              <Typography component="span">$ {toTokenAmount(index, 18).sqrt().toFixed(2).toLocaleString()}</Typography>
              <Tooltip title={Tooltips.SpotPrice}>
                <FiberManualRecordIcon fontSize="small" className={clsx(classes.dotIcon, classes.infoIcon)} />
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
            version="Crab Strategy V1"
          />
        )}

        {!!address && currentCrabPositionValueInETHV2.isGreaterThan(0) && (
          <CrabPosition
            depositedEth={depositedEthV2}
            depositedUsd={depositedUsdV2}
            loading={isCrabV2loading}
            pnlWMidPriceInUSD={pnlWMidPriceInUSDV2}
            pnlWMidPriceInPerct={pnlWMidPriceInPerctV2}
            currentCrabPositionValue={currentCrabPositionValueV2}
            currentCrabPositionValueInETH={currentCrabPositionValueInETHV2}
            version="Crab Strategy V2"
          />
        )}

        {activePositions?.length > 0 && (
          <>
            <div className={classes.header}>
              <Typography color="primary" variant="h6">
                Your LP Positions
              </Typography>
            </div>
            <LPTable isLPage={false} pool={pool!} />
          </>
        )}

        <Box mt={8} component="section">
          <Typography color="primary" variant="h6">
            Your Vaults
          </Typography>
          <Box mt={2}>
            <YourVaults />
          </Box>
        </Box>

        <div className={classes.history}>
          <Typography color="primary" variant="h6">
            Transaction History
          </Typography>
          <History />
        </div>
      </div>
    </div>
  )
}
