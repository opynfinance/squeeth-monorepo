import { createStyles, makeStyles, Tooltip, Typography } from '@material-ui/core'
import FiberManualRecordIcon from '@material-ui/icons/FiberManualRecord'
import InfoIcon from '@material-ui/icons/InfoOutlined'
import Link from 'next/link'
import { useMemo } from 'react'
import BigNumber from 'bignumber.js'
import clsx from 'clsx'

import { LPTable } from '@components/Lp/LPTable'
import Nav from '@components/Nav'
import History from '@components/Trade/History'
import { PositionType } from '../src/types/'
import { Tooltips } from '../src/constants'
import { useSqueethPool } from '@hooks/contracts/useSqueethPool'
import { useWorldContext } from '@context/world'
import { usePnL } from '@hooks/usePositions'
import { useVaultLiquidations } from '@hooks/contracts/useLiquidations'
import { toTokenAmount } from '@utils/calculations'
import { useController } from '../src/hooks/contracts/useController'
import { CrabProvider } from '@context/crabStrategy'
import { useCrabPosition } from '@hooks/useCrabPosition'
import { useWallet } from '@context/wallet'
import { usePositions } from '@context/positions'
import { LinkButton } from '@components/Button'
import { useVaultData } from '@hooks/useVaultData'

const useStyles = makeStyles((theme) =>
  createStyles({
    container: {
      margin: theme.spacing(6, 8),
      width: '800px',
      marginLeft: 'auto',
      marginRight: 'auto',
      paddingBottom: theme.spacing(8),
      [theme.breakpoints.down('sm')]: {
        width: '100%',
        padding: theme.spacing(0, 2),
      },
    },
    header: {
      marginTop: theme.spacing(8),
      display: 'flex',
      justifyContent: 'space-between',
    },
    position: {
      padding: theme.spacing(2),
      backgroundColor: `${theme.palette.background.paper}40`,
      marginTop: theme.spacing(2),
      borderRadius: theme.spacing(1),
      display: 'flex',
      justifyContent: 'space-between',
      [theme.breakpoints.down('sm')]: {
        display: 'block',
      },
    },
    positionData: {
      display: 'flex',
      justifyContent: 'space-between',
      width: '65%',
      [theme.breakpoints.down('sm')]: {
        marginTop: theme.spacing(1),
        width: '100%',
      },
    },
    shortPositionData: {
      width: '65%',
      [theme.breakpoints.down('sm')]: {
        marginTop: theme.spacing(1),
        width: '100%',
      },
    },
    innerPositionData: {
      display: 'flex',
      width: '100%',
    },
    positionTitle: {
      width: '30%',
      [theme.breakpoints.down('sm')]: {
        width: '100%',
      },
    },
    empty: {
      marginTop: theme.spacing(2),
    },
    green: {
      color: theme.palette.success.main,
    },
    red: {
      color: theme.palette.error.main,
    },
    history: {
      marginTop: theme.spacing(8),
      marginBottom: theme.spacing(8),
    },
    link: {
      color: theme.palette.primary.main,
      textDecoration: 'underline',
      fontWeight: 600,
      fontSize: 14,
      marginTop: theme.spacing(1),
    },
    infoIcon: {
      fontSize: '10px',
      marginLeft: theme.spacing(0.5),
    },
    tooltipContainer: {
      marginLeft: '.5em',
    },
    dotIcon: {
      marginRight: '1em',
    },
  }),
)

const PositionsHome = () => {
  const { address } = useWallet()

  if (address)
    return (
      <CrabProvider>
        <Positions />{' '}
      </CrabProvider>
    )

  return <ConnectWallet />
}

const ConnectWallet: React.FC = () => {
  const { selectWallet } = useWallet()
  const classes = useStyles()

  return (
    <div>
      <Nav />
      <div className={classes.container}>
        <LinkButton style={{ margin: 'auto' }} onClick={selectWallet}>
          Connect Wallet
        </LinkButton>
      </div>
    </div>
  )
}

export function Positions() {
  const classes = useStyles()
  const { longGain, shortGain, buyQuote, sellQuote, shortUnrealizedPNL, loading: isPnLLoading } = usePnL()

  const { pool } = useSqueethPool()

  const { oSqueethBal } = useWorldContext()
  const { address } = useWallet()

  const {
    positionType,
    squeethAmount,
    wethAmount,
    loading: isPositionLoading,
    shortVaults,
    firstValidVault,
    vaultId,
    existingCollat,
    lpedSqueeth,
    mintedDebt,
    shortDebt,
    isLong,
    shortRealizedPNL,
    longRealizedPNL,
    activePositions,
  } = usePositions()

  const { index } = useController()
  const {
    depositedEth,
    depositedUsd,
    minCurrentEth,
    minCurrentUsd,
    minPnL,
    minPnlUsd,
    loading: crabLoading,
  } = useCrabPosition(address || '')

  const vaultExists = useMemo(() => {
    return shortVaults.length && shortVaults[firstValidVault]?.collateralAmount?.isGreaterThan(0)
  }, [firstValidVault, shortVaults?.length])

  const { liquidations } = useVaultLiquidations(Number(vaultId))
  const { existingCollatPercent, existingLiqPrice } = useVaultData(Number(vaultId))

  const fullyLiquidated = useMemo(() => {
    return shortVaults.length && shortVaults[firstValidVault]?.shortAmount?.isZero() && liquidations.length > 0
  }, [firstValidVault, shortVaults?.length, liquidations?.length])

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
        {!shortDebt.isGreaterThan(0) &&
        depositedEth.isZero() &&
        !squeethAmount.isGreaterThan(0) &&
        !mintedDebt.isGreaterThan(0) ? (
          <div className={classes.empty}>
            <Typography>No active positions</Typography>
          </div>
        ) : null}

        {!shortDebt.isGreaterThan(0) && positionType === PositionType.LONG ? (
          <div className={classes.position}>
            <div className={classes.positionTitle}>
              <Typography>Long Squeeth</Typography>
            </div>
            <div className={classes.shortPositionData}>
              <div className={classes.innerPositionData}>
                <div style={{ width: '50%' }}>
                  <Typography variant="caption" component="span" color="textSecondary">
                    Position
                  </Typography>
                  <Typography variant="body1">
                    {isPositionLoading && squeethAmount.isEqualTo(0) ? 'Loading' : squeethAmount.toFixed(8)}
                    &nbsp; oSQTH
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    $
                    {isPnLLoading && sellQuote.amountOut.times(toTokenAmount(index, 18).sqrt()).isEqualTo(0)
                      ? 'Loading'
                      : sellQuote.amountOut.times(toTokenAmount(index, 18).sqrt()).toFixed(2)}
                  </Typography>
                </div>
                <div style={{ width: '50%' }}>
                  <Typography variant="caption" color="textSecondary">
                    Unrealized P&L
                  </Typography>
                  <Tooltip title={Tooltips.UnrealizedPnL}>
                    <InfoIcon fontSize="small" className={classes.infoIcon} />
                  </Tooltip>
                  {isPnLLoading || longGain.isLessThanOrEqualTo(-100) || !longGain.isFinite() ? (
                    <Typography variant="body1">Loading</Typography>
                  ) : (
                    <>
                      <Typography variant="body1" className={longGain.isLessThan(0) ? classes.red : classes.green}>
                        ${sellQuote.amountOut.minus(wethAmount.abs()).times(toTokenAmount(index, 18).sqrt()).toFixed(2)}{' '}
                        ({sellQuote.amountOut.minus(wethAmount.abs()).toFixed(5)} ETH)
                      </Typography>
                      <Typography variant="caption" className={longGain.isLessThan(0) ? classes.red : classes.green}>
                        {(longGain || 0).toFixed(2)}%
                      </Typography>
                    </>
                  )}
                </div>
              </div>
              <div className={classes.innerPositionData} style={{ marginTop: '16px' }}>
                <div style={{ width: '50%' }}>
                  <Typography variant="caption" component="span" color="textSecondary">
                    Realized P&L
                  </Typography>
                  <Tooltip
                    title={isLong ? Tooltips.RealizedPnL : `${Tooltips.RealizedPnL}. ${Tooltips.ShortCollateral}`}
                  >
                    <InfoIcon fontSize="small" className={classes.infoIcon} />
                  </Tooltip>
                  <Typography variant="body1" className={longRealizedPNL.gte(0) ? classes.green : classes.red}>
                    $ {isPnLLoading && longRealizedPNL.isEqualTo(0) ? 'Loading' : longRealizedPNL.toFixed(2)}
                  </Typography>
                </div>
              </div>
            </div>
          </div>
        ) : null}
        {shortDebt.isGreaterThan(0) && vaultExists && !fullyLiquidated ? (
          <div className={classes.position}>
            <div className={classes.positionTitle}>
              <Typography>Short Squeeth</Typography>
              <Typography className={classes.link}>
                <Link href={`vault/${vaultId}`}>Manage</Link>
              </Typography>
            </div>
            <div className={classes.shortPositionData}>
              <div className={classes.innerPositionData}>
                <div style={{ width: '50%' }}>
                  <Typography variant="caption" component="span" color="textSecondary">
                    Position
                  </Typography>
                  {isPositionLoading ? (
                    <Typography variant="body1">Loading</Typography>
                  ) : (
                    <>
                      <Typography variant="body1">{squeethAmount.toFixed(8) + ' oSQTH'}</Typography>
                      <Typography variant="body2" color="textSecondary">
                        ${buyQuote.times(toTokenAmount(index, 18).sqrt()).toFixed(2)}
                      </Typography>
                    </>
                  )}
                </div>
                <div style={{ width: '50%' }}>
                  <Typography variant="caption" color="textSecondary">
                    Unrealized P&L
                  </Typography>
                  <Tooltip
                    title={isLong ? Tooltips.UnrealizedPnL : `${Tooltips.UnrealizedPnL}. ${Tooltips.ShortCollateral}`}
                  >
                    <InfoIcon fontSize="small" className={classes.infoIcon} />
                  </Tooltip>
                  {isPositionLoading || shortGain.isLessThanOrEqualTo(-100) || !shortGain.isFinite() ? (
                    <Typography variant="body1">Loading</Typography>
                  ) : (
                    <>
                      <Typography variant="body1" className={shortGain.isLessThan(0) ? classes.red : classes.green}>
                        $ {shortUnrealizedPNL.toFixed(2)} ({wethAmount.minus(buyQuote).toFixed(5)} ETH)
                      </Typography>
                      <Typography variant="caption" className={shortGain.isLessThan(0) ? classes.red : classes.green}>
                        {(shortGain || 0).toFixed(2)}%
                      </Typography>
                    </>
                  )}
                </div>
              </div>
              <div className={classes.innerPositionData} style={{ marginTop: '16px' }}>
                <div style={{ width: '50%' }}>
                  <Typography variant="caption" component="span" color="textSecondary">
                    Liquidation Price
                  </Typography>
                  <Tooltip title={Tooltips.LiquidationPrice}>
                    <InfoIcon fontSize="small" className={classes.infoIcon} />
                  </Tooltip>
                  <Typography variant="body1">
                    {isPositionLoading && existingLiqPrice.isEqualTo(0) ? 'Loading' : '$' + existingLiqPrice.toFixed(2)}
                  </Typography>
                </div>
                <div style={{ width: '50%' }}>
                  <Typography variant="caption" component="span" color="textSecondary">
                    Collateral (Amt / Ratio)
                  </Typography>
                  <Typography variant="body1">
                    {isPositionLoading && existingCollat.isEqualTo(0) ? 'Loading' : existingCollat.toFixed(4)} ETH (
                    {existingCollatPercent}%)
                  </Typography>
                </div>
              </div>
              <div className={classes.innerPositionData} style={{ marginTop: '16px' }}>
                <div style={{ width: '50%' }}>
                  <Typography variant="caption" component="span" color="textSecondary">
                    Realized P&L
                  </Typography>
                  <Tooltip title={Tooltips.RealizedPnL}>
                    <InfoIcon fontSize="small" className={classes.infoIcon} />
                  </Tooltip>
                  <Typography variant="body1" className={shortRealizedPNL.gte(0) ? classes.green : classes.red}>
                    $ {isPnLLoading && shortRealizedPNL.isEqualTo(0) ? 'Loading' : shortRealizedPNL.toFixed(2)}
                  </Typography>
                </div>
              </div>
            </div>
          </div>
        ) : null}
        {lpedSqueeth.isGreaterThan(0) && vaultExists && !fullyLiquidated ? (
          <div className={classes.position}>
            <div className={classes.positionTitle}>
              <Typography>LPed Squeeth</Typography>
              <Typography className={classes.link}>
                {vaultExists ? <Link href={`vault/${vaultId}`}>Manage</Link> : null}
              </Typography>
            </div>
            <div className={classes.shortPositionData}>
              <div className={classes.innerPositionData}>
                <div style={{ width: '50%' }}>
                  <Typography variant="caption" component="span" color="textSecondary">
                    Amount
                  </Typography>
                  <Typography variant="body1">
                    {lpedSqueeth.toFixed(8)}
                    &nbsp; oSQTH
                  </Typography>
                </div>
              </div>
              <div className={classes.innerPositionData} style={{ marginTop: '16px' }}>
                {new BigNumber(existingLiqPrice).isFinite() ? (
                  <div style={{ width: '50%' }}>
                    <Typography variant="caption" component="span" color="textSecondary">
                      Liquidation Price
                    </Typography>
                    <Tooltip title={Tooltips.LiquidationPrice}>
                      <InfoIcon fontSize="small" className={classes.infoIcon} />
                    </Tooltip>
                    <Typography variant="body1">
                      ${isPositionLoading && existingLiqPrice.isEqualTo(0) ? 'Loading' : existingLiqPrice.toFixed(2)}
                    </Typography>
                  </div>
                ) : null}
                <div style={{ width: '50%' }}>
                  <Typography variant="caption" component="span" color="textSecondary">
                    Collateral (Amt / Ratio)
                  </Typography>
                  <Typography variant="body1">
                    {isPositionLoading && existingCollat.isEqualTo(0) ? 'Loading' : existingCollat.toFixed(4)} ETH
                    {new BigNumber(existingCollatPercent).isFinite() ? ' (' + existingCollatPercent + ' %)' : null}
                  </Typography>
                </div>
              </div>
            </div>
          </div>
        ) : null}
        {mintedDebt.isGreaterThan(0) && !fullyLiquidated ? (
          <div className={classes.position}>
            <div className={classes.positionTitle}>
              <Typography>Minted Squeeth</Typography>
              <Typography className={classes.link}>
                {vaultExists ? <Link href={`vault/${vaultId}`}>Manage</Link> : null}
              </Typography>
            </div>
            <div className={classes.shortPositionData}>
              <div className={classes.innerPositionData}>
                <div style={{ width: '50%' }}>
                  <Typography variant="caption" component="span" color="textSecondary">
                    Amount
                  </Typography>
                  <Typography variant="body1">
                    {oSqueethBal?.isGreaterThan(0) &&
                    positionType === PositionType.LONG &&
                    oSqueethBal.minus(squeethAmount).isGreaterThan(0)
                      ? oSqueethBal.minus(squeethAmount).toFixed(8)
                      : oSqueethBal.toFixed(8)}
                    &nbsp; oSQTH
                  </Typography>
                </div>
              </div>
              <div className={classes.innerPositionData} style={{ marginTop: '16px' }}>
                {new BigNumber(existingLiqPrice).isFinite() ? (
                  <div style={{ width: '50%' }}>
                    <Typography variant="caption" component="span" color="textSecondary">
                      Liquidation Price
                    </Typography>
                    <Tooltip title={Tooltips.LiquidationPrice}>
                      <InfoIcon fontSize="small" className={classes.infoIcon} />
                    </Tooltip>
                    <Typography variant="body1">
                      $ {isPositionLoading && existingLiqPrice.isEqualTo(0) ? 'Loading' : existingLiqPrice.toFixed(2)}
                    </Typography>
                  </div>
                ) : null}
                <div style={{ width: '50%' }}>
                  <Typography variant="caption" component="span" color="textSecondary">
                    Collateral (Amt / Ratio)
                  </Typography>
                  <Typography variant="body1">
                    {isPositionLoading && existingCollat.isEqualTo(0) ? 'Loading' : existingCollat.toFixed(4)} ETH
                    {new BigNumber(existingCollatPercent).isFinite() ? ' (' + existingCollatPercent + ' %)' : null}
                  </Typography>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {liquidations.length > 0 ? (
          <div className={classes.position}>
            <div className={classes.positionTitle}>
              <Typography className={classes.red}>Short Squeeth - Liquidated</Typography>
              <Typography className={classes.link}>
                <Link href={`vault/${vaultId}`}>Manage</Link>
              </Typography>
            </div>
            <div className={classes.shortPositionData}>
              <div className={classes.innerPositionData}>
                <div style={{ width: '50%' }}>
                  <Typography variant="caption" component="span" color="textSecondary">
                    Redeemable Collateral
                  </Typography>
                  <Typography variant="body1">
                    {isPositionLoading && existingCollat.isEqualTo(0) ? 'Loading' : existingCollat.toFixed(4)} ETH
                    {new BigNumber(existingCollatPercent).isFinite() ? ' (' + existingCollatPercent + ' %)' : null}
                  </Typography>
                </div>
              </div>
            </div>
          </div>
        ) : null}
        {!!address ? (
          <CrabPosition
            depositedEth={depositedEth}
            depositedUsd={depositedUsd}
            loading={crabLoading}
            minCurrentEth={minCurrentEth}
            minCurrentUsd={minCurrentUsd}
            minPnL={minPnL}
            minPnlUsd={minPnlUsd}
          />
        ) : null}
        {activePositions?.length > 0 ? (
          <>
            <div className={classes.header}>
              <Typography color="primary" variant="h6">
                Your LP Positions
              </Typography>
            </div>
            <LPTable isLPage={false} pool={pool} />
          </>
        ) : null}
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

type CrabPositionType = {
  depositedEth: BigNumber
  depositedUsd: BigNumber
  loading: boolean
  minCurrentEth: BigNumber
  minCurrentUsd: BigNumber
  minPnL: BigNumber
  minPnlUsd: BigNumber
}

const CrabPosition: React.FC<CrabPositionType> = ({
  depositedEth,
  depositedUsd,
  loading,
  minCurrentEth,
  minCurrentUsd,
  minPnL,
  minPnlUsd,
}) => {
  const classes = useStyles()

  if (depositedEth.isZero() || loading) return null

  return (
    <div className={classes.position}>
      <div className={classes.positionTitle}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <Typography>🦀</Typography>
          <Typography style={{ marginLeft: '8px' }}>Crab strategy</Typography>
        </div>
      </div>
      <div className={classes.shortPositionData}>
        <div className={classes.innerPositionData}>
          <div style={{ width: '50%' }}>
            <Typography variant="caption" component="span" color="textSecondary">
              Deposited Amount
            </Typography>
            <Typography variant="body1">$ {depositedUsd.toFixed(2)}</Typography>
            <Typography variant="body2" color="textSecondary">
              {depositedEth.toFixed(6)}
              &nbsp; ETH
            </Typography>
          </div>
          <div style={{ width: '50%' }}>
            <Typography variant="caption" component="span" color="textSecondary">
              Current Position
            </Typography>
            <Typography variant="body1">$ {minCurrentUsd.toFixed(2)}</Typography>
            <Typography variant="body2" color="textSecondary">
              {minCurrentEth.toFixed(6)}
              &nbsp; ETH
            </Typography>
          </div>
        </div>
        <div className={classes.innerPositionData} style={{ marginTop: '16px' }}>
          <div style={{ width: '50%' }}>
            <Typography variant="caption" component="span" color="textSecondary">
              Unrealized P&L
            </Typography>
            <Tooltip title={Tooltips.CrabPnL}>
              <InfoIcon fontSize="small" className={classes.infoIcon} />
            </Tooltip>
            <Typography variant="body1" className={minPnlUsd.gte(0) ? classes.green : classes.red}>
              {!loading ? '$' + `${minPnlUsd.toFixed(2)}` : 'loading'}
            </Typography>
            <Typography variant="caption" className={minPnlUsd.gte(0) ? classes.green : classes.red}>
              {!loading ? `${minPnL.toFixed(2)}` + '%' : 'loading'}
            </Typography>
          </div>
        </div>
      </div>
    </div>
  )
}

export default PositionsHome
