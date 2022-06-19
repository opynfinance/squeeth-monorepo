import { Box, Tooltip, Typography } from '@material-ui/core'
import FiberManualRecordIcon from '@material-ui/icons/FiberManualRecord'

import clsx from 'clsx'
import { useAtomValue } from 'jotai'

import { LPTable } from '@components/Lp/LPTable'
import Nav from '@components/Nav'
import History from '@pages/positions/History'
import { PositionType } from '../../types'
import { Tooltips } from '../../constants'
import { useVaultLiquidations } from '@hooks/contracts/useLiquidations'
import { toTokenAmount } from '@utils/calculations'
import { useCrabPosition } from '@hooks/useCrabPosition'
import { addressAtom } from 'src/state/wallet/atoms'
import {
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
import SqueethPosition from './SqueethPosition'
import LPedSqueeth from './LPedSqueeth'
import MintedSqueeth from './MintedSqueeth'
import ShortSqueethLiquidated from './ShortSqueethLiquidated'
import { useCurrentCrabPositionValue } from 'src/state/crab/hooks'
import { pnl, pnlInPerct } from 'src/lib/pnl'
import usePositionNPnL from '@hooks/usePositionNPnL'

export default function Positions() {
  const classes = useStyles()
  const pool = useAtomValue(poolAtom)
  const address = useAtomValue(addressAtom)
  const positionType = useAtomValue(positionTypeAtom)
  const activePositions = useAtomValue(activePositionsAtom)

  const { currentOSQTHAmount: squeethAmount } = usePositionNPnL()
  const { validVault: vault, vaultId } = useFirstValidVault()
  const lpedSqueeth = useLpDebt()
  const mintedDebt = useMintedDebt()
  const shortDebt = useShortDebt()
  const index = useAtomValue(indexAtom)
  usePositionsAndFeesComputation()
  const { depositedEth, depositedUsd, loading: isCrabPositonLoading } = useCrabPosition(address || '')
  const { currentCrabPositionValue, currentCrabPositionValueInETH, isCrabPositionValueLoading } =
    useCurrentCrabPositionValue()

  const isCrabloading = useAppMemo(() => {
    return isCrabPositonLoading || isCrabPositionValueLoading
  }, [isCrabPositonLoading, isCrabPositionValueLoading])

  const pnlWMidPriceInUSD = useAppMemo(() => {
    return pnl(currentCrabPositionValue, depositedUsd)
  }, [currentCrabPositionValue, depositedUsd])
  const pnlWMidPriceInPerct = useAppMemo(() => {
    return pnlInPerct(currentCrabPositionValue, depositedUsd)
  }, [currentCrabPositionValue, depositedUsd])

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
        squeethAmount.isZero() &&
        mintedDebt.isZero() &&
        lpedSqueeth.isZero() ? (
          <div className={classes.empty}>
            <Typography>No active positions</Typography>
          </div>
        ) : null}

        {positionType != PositionType.NONE && <SqueethPosition />}

        {lpedSqueeth.isGreaterThan(0) && !fullyLiquidated && <LPedSqueeth vaultExists={vaultExists} />}

        {mintedDebt.isGreaterThan(0) && !fullyLiquidated && <MintedSqueeth vaultExists={vaultExists} />}

        {liquidations.length > 0 && <ShortSqueethLiquidated />}

        {!!address && depositedEth.isGreaterThan(0) && (
          <CrabPosition
            depositedEth={depositedEth}
            depositedUsd={depositedUsd}
            loading={isCrabloading}
            pnlWMidPriceInUSD={pnlWMidPriceInUSD}
            pnlWMidPriceInPerct={pnlWMidPriceInPerct}
            currentCrabPositionValue={currentCrabPositionValue}
            currentCrabPositionValueInETH={currentCrabPositionValueInETH}
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
