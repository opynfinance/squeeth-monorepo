import { Hidden, Tooltip } from '@material-ui/core'
import Card from '@material-ui/core/Card'
import { createStyles, makeStyles } from '@material-ui/core/styles'
import Typography from '@material-ui/core/Typography'
import FiberManualRecordIcon from '@material-ui/icons/FiberManualRecord'
import InfoIcon from '@material-ui/icons/InfoOutlined'
import KeyboardArrowDownIcon from '@material-ui/icons/KeyboardArrowDown'
import KeyboardArrowUpIcon from '@material-ui/icons/KeyboardArrowUp'
import Image from 'next/image'
import { useCallback, useState } from 'react'
import { useAtom, useAtomValue } from 'jotai'
import * as Fathom from 'fathom-client'

import squeethTokenSymbol from '../public/images/Squeeth.svg'
import { PrimaryButton } from '@components/Button'
import { LongChart } from '@components/Charts/LongChart'
import { MemoizedShortChart as ShortChart } from '@components/Charts/ShortChart'
import MobileModal from '@components/Modal/MobileModal'
import Nav from '@components/Nav'
import PositionCard from '@components/PositionCard'
import RestrictionInfo from '@components/RestrictionInfo'
import { SqueethTab, SqueethTabs } from '@components/Tabs'
import Trade from '@components/Trade'
import { WelcomeModal } from '@components/Trade/WelcomeModal'
import { Vaults } from '../src/constants'
import { Tooltips } from '@constants/enums'
import { useRestrictUser } from '@context/restrict-user'

import { /* PositionType, */ TradeType } from '../src/types'
import { toTokenAmount } from '@utils/calculations'
import {
  normFactorAtom,
  impliedVolAtom,
  currentImpliedFundingAtom,
  indexAtom,
  markAtom,
  dailyHistoricalFundingAtom,
} from 'src/state/controller/atoms'
import { usePositionsAndFeesComputation } from 'src/state/positions/hooks'
import { actualTradeTypeAtom, ethTradeAmountAtom, sqthTradeAmountAtom, tradeTypeAtom } from 'src/state/trade/atoms'
// import { positionTypeAtom } from 'src/state/positions/atoms'
import { useResetAtom } from 'jotai/utils'
import {
  isTransactionFirstStepAtom,
  transactionDataAtom,
  transactionLoadingAtom,
  supportedNetworkAtom,
} from 'src/state/wallet/atoms'

const useStyles = makeStyles((theme) =>
  createStyles({
    header: {
      color: theme.palette.primary.main,
    },
    mobileContainer: {
      padding: theme.spacing(2),
      paddingBottom: '68px',
    },
    container: {
      display: 'flex',
      height: 'calc(100vh - 64px)',
      margin: '0 auto',
      width: '95%',
      maxWidth: '1600px',
      [theme.breakpoints.up('md')]: {
        marginBottom: '5em',
        paddingBottom: '4em',
      },
    },
    main: {
      display: 'flex',
      flexDirection: 'column',
      marginRight: theme.spacing(2),
      marginTop: theme.spacing(3),
      flexGrow: 1,
      height: '100%',
      maxHeight: '900px',
      [theme.breakpoints.up('lg')]: {
        maxHeight: '700px',
      },

      // border: '1px solid red',
      flexBasis: '70%',
    },
    ticket: {
      width: '350px',
      position: 'sticky',
      margin: theme.spacing(3, 0, 0, 0),
      textAlign: 'center',
      borderRadius: theme.spacing(2),
      top: '88px',
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      maxHeight: '900px',
      [theme.breakpoints.up('lg')]: {
        maxHeight: '700px',
      },
    },
    innerTicket: {
      background: theme.palette.background.lightStone,
      overflow: 'auto',
      flexGrow: 1,
    },
    subHeading: {
      color: theme.palette.text.secondary,
    },
    thirdHeading: {
      marginTop: theme.spacing(3),
    },
    buyCard: {
      marginLeft: theme.spacing(3),
      width: '400px',
    },
    cardTitle: {
      color: theme.palette.primary.main,
      marginTop: theme.spacing(2),
    },
    cardSubTxt: {
      color: theme.palette.text.secondary,
      lineHeight: '1.75rem',
      fontSize: '16px',
    },
    payoff: {
      color: theme.palette.text.secondary,
      lineHeight: '1.75rem',
      fontSize: '16px',
      marginTop: theme.spacing(2),
    },
    cardDetail: {
      color: theme.palette.text.secondary,
      lineHeight: '1.75rem',
      fontSize: '16px',
      marginTop: theme.spacing(4),
    },
    amountInput: {
      marginTop: theme.spacing(3),
    },
    innerCard: {
      textAlign: 'center',
      paddingBottom: theme.spacing(4),
      background: theme.palette.background.lightStone,
    },
    expand: {
      transform: 'rotate(270deg)',
      color: theme.palette.primary.main,
      transition: theme.transitions.create('transform', {
        duration: theme.transitions.duration.shortest,
      }),
      marginTop: theme.spacing(6),
    },
    expandOpen: {
      transform: 'rotate(180deg)',
      color: theme.palette.primary.main,
    },
    squeethInfo: {
      // make it fixed when advanced options are shown or hidden
      minWidth: '58%',
      [theme.breakpoints.down('sm')]: {
        width: '100%',
        marginTop: theme.spacing(2),
      },
    },
    squeethInfoSubGroup: {
      display: 'grid',
      gap: theme.spacing(1),
      gridTemplateColumns: 'repeat(auto-fit, minmax(5rem, 1fr))',
      marginBottom: theme.spacing(2),
      position: 'relative',
    },
    subGroupHeader: {
      marginBottom: theme.spacing(1),
    },
    infoIcon: {
      fontSize: '14px',
      marginLeft: theme.spacing(0.5),
      marginTop: theme.spacing(0.5),
    },
    infoItem: {
      // minWidth: '22%',
      paddingRight: theme.spacing(1.5),
      //borderRight: `1px solid ${theme.palette.background.lightStone}`,
    },
    infoLabel: {
      display: 'flex',
    },
    advancedDetails: {
      background: 'none',
      border: 'none',
      display: 'flex',
      alignItems: 'center',
      cursor: 'pointer',
      width: 'max-content',
      paddingLeft: 8,
      borderRadius: 5,
      '&:hover': {
        background: 'rgba(255, 255, 255, 0.08)',
      },
    },
    position: {
      borderRadius: theme.spacing(2),
      // position: 'sticky',
      top: '88px',
    },
    positionContainer: {
      display: 'flex',
      marginTop: theme.spacing(1),
      justifyContent: 'space-between',
    },
    logoContainer: {
      display: 'flex',
    },
    logoTitle: {
      marginLeft: theme.spacing(1),
      [theme.breakpoints.down('sm')]: {
        fontSize: 18,
      },
    },
    logoSubTitle: {
      marginLeft: theme.spacing(1),
      [theme.breakpoints.down('sm')]: {
        fontSize: 16,
      },
    },
    logo: {
      marginTop: theme.spacing(0.5),
      alignSelf: 'flex-start',
    },
    positionH: {},
    tradeDetails: {
      flexGrow: 1,
      marginTop: theme.spacing(2),
      paddingLeft: theme.spacing(2),
      paddingRight: theme.spacing(2),
      paddingTop: theme.spacing(3),
      paddingBottom: theme.spacing(3),
      borderRadius: theme.spacing(1),
      background: theme.palette.background.lightStone,
    },
    subNavTabs: {
      marginBottom: theme.spacing(2),
      [theme.breakpoints.down('sm')]: {
        marginBottom: 0,
      },
    },
    green: {
      color: theme.palette.success.main,
      marginRight: theme.spacing(4),
      fontSize: '16px',
    },
    red: {
      color: theme.palette.error.main,
      marginRight: theme.spacing(4),
      fontSize: '16px',
    },
    pi: {
      marginLeft: theme.spacing(2),
    },
    squeethContainer: {
      // border: `1px solid ${theme.palette.background.stone}`,
      borderRadius: theme.spacing(1),
    },
    accordionRoot: {
      backgroundColor: 'transparent',
      // borderRadius: theme.spacing(4),
      boxShadow: 'none',
      padding: theme.spacing(0),
    },
    accordionExpanded: {
      minHeight: '0px',
    },
    detailsRoot: {
      padding: theme.spacing(0, 2, 2, 2),
    },
    arrowBtn: {
      borderRadius: theme.spacing(1),
      marginLeft: theme.spacing(1),
    },
    mobileSpacer: {
      marginTop: theme.spacing(2),
    },
    mobileAction: {
      position: 'fixed',
      height: '64px',
      bottom: 0,
      width: '100%',
      zIndex: 20,
      display: 'flex',
      borderTop: `1px solid ${theme.palette.background.lightStone}`,
      padding: theme.spacing(0.5),
      justifyContent: 'space-around',
      alignItems: 'center',
      background: theme.palette.background.default,
    },
    longIndicator: {
      background: theme.palette.success.main,
      borderRadius: theme.spacing(0.7),
      opacity: '.3',
    },
    shortIndicator: {
      background: theme.palette.error.main,
      borderRadius: theme.spacing(0.7),
      opacity: '.3',
    },
    longTab: {
      color: theme.palette.success.main,
      '&$selected': {
        color: theme.palette.success.main,
        fontWeight: theme.typography.fontWeightBold,
      },
    },
    shortTab: {
      color: theme.palette.error.main,
      '&$selected': {
        color: theme.palette.error.main,
        fontWeight: theme.typography.fontWeightBold,
      },
    },
    displayBlock: {
      display: 'block',
    },
    displayNone: {
      display: 'none',
    },
  }),
)

const Header: React.FC = () => {
  const classes = useStyles()
  const tradeType = useAtomValue(tradeTypeAtom)

  return (
    <>
      <div className={classes.logoContainer}>
        <div className={classes.logo}>
          <Image src={squeethTokenSymbol} alt="squeeth token" width={37} height={37} />
        </div>
        <div>
          <Typography variant="h5" className={classes.logoTitle}>
            {tradeType === TradeType.LONG ? (
              <>Long Squeeth - ETH&sup2; Position</>
            ) : (
              <>Covered Short Squeeth - Short ETH&sup2; Position</>
            )}
          </Typography>
          <Typography className={classes.logoSubTitle} variant="body1" color="textSecondary">
            {tradeType === TradeType.LONG ? (
              <>Perpetual leverage without liquidations</>
            ) : (
              <>Earn premiums for selling ETH collateralized squeeth</>
            )}
          </Typography>
        </div>
      </div>
    </>
  )
}

const TabComponent: React.FC = () => {
  const classes = useStyles()
  const [tradeType, setTradeType] = useAtom(tradeTypeAtom)
  const resetEthTradeAmount = useResetAtom(ethTradeAmountAtom)
  const resetSqthTradeAmount = useResetAtom(sqthTradeAmountAtom)
  const resetTransactionData = useResetAtom(transactionDataAtom)
  const transactionInProgress = useAtomValue(transactionLoadingAtom)
  const isTxFirstStep = useAtomValue(isTransactionFirstStepAtom)

  return (
    <div>
      <SqueethTabs
        value={tradeType}
        onChange={(evt, val) => {
          setTradeType(val)

          if (!transactionInProgress || !isTxFirstStep) {
            resetEthTradeAmount()
            resetSqthTradeAmount()
            resetTransactionData()
          }
        }}
        aria-label="Sub nav tabs"
        className={classes.subNavTabs}
        centered
        classes={{ indicator: tradeType === TradeType.SHORT ? classes.shortIndicator : classes.longIndicator }}
      >
        <SqueethTab
          style={{ width: '50%', color: '#49D273' }}
          classes={{ root: classes.longTab, selected: classes.longTab }}
          label="Long"
          id="long-card-btn"
        />
        <SqueethTab
          style={{ width: '50%', color: '#f5475c' }}
          classes={{ root: classes.shortTab, selected: classes.shortTab }}
          label="Short"
          id="short-card-btn"
        />
      </SqueethTabs>
    </div>
  )
}

const SqueethInfo: React.FC = () => {
  const classes = useStyles()
  const actualTradeType = useAtomValue(actualTradeTypeAtom)
  const dailyHistoricalFunding = useAtomValue(dailyHistoricalFundingAtom)
  const mark = useAtomValue(markAtom)
  const index = useAtomValue(indexAtom)
  const impliedVol = useAtomValue(impliedVolAtom)
  const currentImpliedFunding = useAtomValue(currentImpliedFundingAtom)
  const normFactor = useAtomValue(normFactorAtom)
  usePositionsAndFeesComputation()

  const [showAdvanced, setShowAdvanced] = useState(false)

  const toggleAdvanced = useCallback(() => {
    setShowAdvanced((prevState) => !prevState)
    Fathom.trackGoal('DRFFVOPH', 0)
  }, [setShowAdvanced])

  return (
    <div className={classes.squeethInfo}>
      <div>
        <div className={classes.squeethInfoSubGroup}>
          {/* hard coded width layout to align with the next line */}
          <div className={classes.infoItem}>
            <div className={classes.infoLabel}>
              <Typography color="textSecondary" variant="body2">
                ETH Price
              </Typography>
              <Tooltip title={Tooltips.SpotPrice}>
                <FiberManualRecordIcon fontSize="small" className={classes.infoIcon} />
              </Tooltip>
            </div>
            <Typography>${Number(toTokenAmount(index, 18).sqrt()).toFixed(2).toLocaleString()}</Typography>
          </div>
          <div className={classes.infoItem}>
            <div className={classes.infoLabel}>
              <Typography color="textSecondary" variant="body2">
                Historical Daily Premium
              </Typography>
              <Tooltip
                title={`Historical daily premium based on the last ${dailyHistoricalFunding.period} hours. Calculated using a ${dailyHistoricalFunding.period} hour TWAP of Mark - Index`}
              >
                <InfoIcon fontSize="small" className={classes.infoIcon} />
              </Tooltip>
            </div>
            <Typography>
              {dailyHistoricalFunding.funding === 0
                ? 'loading'
                : (dailyHistoricalFunding.funding * 100).toFixed(2) + '%'}
            </Typography>
          </div>
          <div className={classes.infoItem}>
            <div className={classes.infoLabel}>
              <Typography color="textSecondary" variant="body2">
                Current Implied Premium
              </Typography>
              <Tooltip title={Tooltips.CurrentImplFunding}>
                <InfoIcon fontSize="small" className={classes.infoIcon} />
              </Tooltip>
            </div>
            <Typography>
              {currentImpliedFunding === 0 ? 'loading' : (currentImpliedFunding * 100).toFixed(2) + '%'}
            </Typography>
          </div>
          <div className={classes.infoItem}>
            <div className={classes.infoLabel}>
              <Typography color="textSecondary" variant="body2">
                Funding
              </Typography>
              <Tooltip
                title={`${Tooltips.FundingPayments}. ${
                  actualTradeType === TradeType.LONG
                    ? 'Funding is paid out of your position'
                    : 'Funding is paid continuously to you from oSQTH token holders'
                }`}
              >
                <InfoIcon fontSize="small" className={classes.infoIcon} />
              </Tooltip>
            </div>
            <Typography>Continuous, In-Kind</Typography>
          </div>
        </div>
      </div>
      <div>
        {/* hard coded width layout to align with the prev line */}

        {showAdvanced ? (
          <div className={classes.squeethInfoSubGroup}>
            <div className={classes.infoItem}>
              <div className={classes.infoLabel}>
                <Typography color="textSecondary" variant="body2">
                  ETH&sup2; Price
                </Typography>
                <Tooltip title={Tooltips.SpotPrice}>
                  <FiberManualRecordIcon fontSize="small" className={classes.infoIcon} />
                </Tooltip>
              </div>
              <Typography>${Number(toTokenAmount(index, 18).toFixed(0)).toLocaleString() || 'loading'}</Typography>
            </div>
            <div className={classes.infoItem}>
              <div className={classes.infoLabel}>
                <Typography color="textSecondary" variant="body2">
                  Mark Price
                </Typography>
                <Tooltip title={`${Tooltips.Mark}. ${Tooltips.SpotPrice}`}>
                  <FiberManualRecordIcon fontSize="small" className={classes.infoIcon} />
                </Tooltip>
              </div>
              <Typography>${Number(toTokenAmount(mark, 18).toFixed(0)).toLocaleString() || 'loading'}</Typography>
            </div>
            <div className={classes.infoItem}>
              <div className={classes.infoLabel}>
                <Typography color="textSecondary" variant="body2">
                  Implied Volatility
                </Typography>
                <Tooltip title={Tooltips.ImplVol}>
                  <InfoIcon fontSize="small" className={classes.infoIcon} />
                </Tooltip>
              </div>
              <Typography>{(impliedVol * 100).toFixed(2)}%</Typography>
            </div>
            <div className={classes.infoItem}>
              <div className={classes.infoLabel}>
                <Typography color="textSecondary" variant="body2">
                  Norm Factor
                </Typography>
                <Tooltip title={Tooltips.NormFactor}>
                  <InfoIcon fontSize="small" className={classes.infoIcon} />
                </Tooltip>
              </div>
              <Typography>{normFactor.toFixed(4)}</Typography>
            </div>
          </div>
        ) : null}
        <div className={classes.squeethInfoSubGroup}>
          <button className={classes.advancedDetails} onClick={toggleAdvanced}>
            <Typography color="textSecondary" variant="body2">
              Advanced details
            </Typography>

            {!showAdvanced ? <KeyboardArrowDownIcon htmlColor="#fff" /> : <KeyboardArrowUpIcon htmlColor="#fff" />}
          </button>
        </div>
      </div>
    </div>
  )
}

function TradePage() {
  const classes = useStyles()
  const { isRestricted } = useRestrictUser()
  const supportedNetwork = useAtomValue(supportedNetworkAtom)

  const tradeType = useAtomValue(tradeTypeAtom)
  const [showMobileTrade, setShowMobileTrade] = useState(false)
  const [isWelcomeModalOpen, setWelcomeModalOpen] = useState(false)

  const handleClose = () => {
    setWelcomeModalOpen(false)
  }

  return (
    <div>
      <Nav />
      <Hidden smDown>
        <div className={classes.container}>
          <div className={classes.main}>
            <div className={classes.position}>
              <Header />
              <div className={classes.positionContainer}>
                <SqueethInfo />
                {supportedNetwork && <PositionCard />}
              </div>
            </div>
            <div className={classes.tradeDetails}>
              {tradeType === TradeType.LONG ? (
                <LongChart />
              ) : (
                <ShortChart vault={Vaults.Short} longAmount={0} showPercentage={true} setCustomLong={() => null} />
              )}
            </div>
          </div>

          <div className={classes.ticket}>
            {supportedNetwork && (
              <>
                <TabComponent />
                <Card className={classes.innerTicket}>{!isRestricted ? <Trade /> : <RestrictionInfo />}</Card>
              </>
            )}
          </div>
        </div>
      </Hidden>
      <Hidden mdUp>
        <div className={classes.mobileContainer}>
          <Header />
          <div className={classes.mobileSpacer}>
            {tradeType === TradeType.LONG ? (
              <LongChart />
            ) : (
              <ShortChart vault={Vaults.Short} longAmount={0} showPercentage={true} setCustomLong={() => null} />
            )}
          </div>
          <div className={classes.mobileSpacer}>
            <PositionCard />
          </div>
        </div>
        {supportedNetwork && (
          <>
            <div className={classes.mobileAction}>
              <div style={{ width: '65%' }}>
                <TabComponent />
              </div>
              <PrimaryButton variant="contained" style={{ minWidth: '30%' }} onClick={() => setShowMobileTrade(true)}>
                Trade
              </PrimaryButton>
            </div>
            <MobileModal title="TRADE" isOpen={showMobileTrade} onClose={() => setShowMobileTrade(false)}>
              <TabComponent />
              <Card className={classes.innerTicket} style={{ textAlign: 'center', marginTop: '8px' }}>
                {!isRestricted ? <Trade /> : <RestrictionInfo />}
              </Card>
            </MobileModal>
          </>
        )}
      </Hidden>
      <WelcomeModal open={isWelcomeModalOpen} handleClose={handleClose} />
    </div>
  )
}

export function App() {
  return (
    <>
      <TradePage />
    </>
  )
}

export default App
