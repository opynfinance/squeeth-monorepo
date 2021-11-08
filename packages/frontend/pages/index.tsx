import { Button, Hidden, IconButton, Tooltip } from '@material-ui/core'
import Card from '@material-ui/core/Card'
import { createStyles, makeStyles } from '@material-ui/core/styles'
import Typography from '@material-ui/core/Typography'
import InfoIcon from '@material-ui/icons/InfoOutlined'
import ExpandLessIcon from '@material-ui/icons/NavigateBefore'
import ExpandMoreIcon from '@material-ui/icons/NavigateNext'
import Image from 'next/image'
import { useCallback, useEffect, useState } from 'react'

import squeethTokenSymbol from '../public/images/Squeeth.png'
import { PrimaryButton } from '../src/components/Buttons'
import { LongChart } from '../src/components/Charts/LongChart'
import { VaultChart } from '../src/components/Charts/VaultChart'
import MobileModal from '../src/components/MobileModal'
import Nav from '../src/components/Nav'
import PositionCard from '../src/components/PositionCard'
import { SqueethTab, SqueethTabs } from '../src/components/Tabs'
import Trade from '../src/components/Trade'
import { Vaults } from '../src/constants'
import { TradeProvider, useTrade } from '../src/context/trade'
import { useWorldContext } from '../src/context/world'
import { useController } from '../src/hooks/contracts/useController'
import { useETHPrice } from '../src/hooks/useETHPrice'
import { useETHPriceCharts } from '../src/hooks/useETHPriceCharts'
import { TradeType } from '../src/types'
import { toTokenAmount } from '../src/utils/calculations'

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
      maxHeight: '1000px',
      margin: '0 auto',
      width: '95%',
      maxWidth: '1600px',
    },
    main: {
      display: 'flex',
      flexDirection: 'column',
      marginRight: theme.spacing(2),
      marginBottom: theme.spacing(3),
      marginTop: theme.spacing(3),
      flexGrow: 1,
    },
    ticket: {
      width: '350px',
      position: 'sticky',
      margin: theme.spacing(3, 0, 3, 0),
      textAlign: 'center',
      borderRadius: theme.spacing(2),
      top: '88px',
      display: 'flex',
      flexDirection: 'column',
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
      display: 'flex',
      marginBottom: theme.spacing(2),
      alignItems: 'center',
    },
    subGroupHeader: {
      marginBottom: theme.spacing(1),
    },
    infoIcon: {
      fontSize: '14px',
      marginLeft: theme.spacing(0.5),
    },
    infoItem: {
      // minWidth: '22%',
      paddingRight: theme.spacing(1.5),
      //borderRight: `1px solid ${theme.palette.background.lightStone}`,
    },
    infoLabel: {
      display: 'flex',
      alignItems: 'center',
    },
    position: {
      borderRadius: theme.spacing(2),
      // position: 'sticky',
      top: '88px',
      // zIndex: 20,
    },
    positionContainer: {
      display: 'flex',
      marginTop: theme.spacing(1),
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
  }),
)

function TradePage() {
  const classes = useStyles()
  const ethPrice = useETHPrice()
  const { fundingPerDay, mark, index, impliedVol } = useController()

  const { volMultiplier, setVolMultiplier } = useWorldContext()
  const { tradeType, setTradeType, actualTradeType } = useTrade()
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [showMobileTrade, setShowMobileTrade] = useState(false)

  useEffect(() => {
    if (tradeType === TradeType.LONG) setVolMultiplier(1.2)
    else setVolMultiplier(0.9)
  }, [tradeType])

  const SqueethInfo = useCallback(() => {
    return (
      <div className={classes.squeethInfo}>
        <div>
          <div className={classes.squeethInfoSubGroup}>
            {/* hard coded width layout to align with the next line */}
            <div className={classes.infoItem} style={{ width: '18%' }}>
              <Typography color="textSecondary" variant="body2">
                ETH Price
              </Typography>
              <Typography>${ethPrice.toNumber().toLocaleString()}</Typography>
            </div>
            <div className={classes.infoItem} style={{ width: '30%' }}>
              <div className={classes.infoLabel}>
                <Typography color="textSecondary" variant="body2">
                  Expected 24h Funding
                </Typography>
                <Tooltip
                  title={'Estimated amount of funding paid in next 24 hours. Funding will happen out of your position.'}
                >
                  <InfoIcon fontSize="small" className={classes.infoIcon} />
                </Tooltip>
              </div>
              <Typography>{(fundingPerDay * 100).toFixed(2)}%</Typography>
            </div>
            <div className={classes.infoItem} style={{ width: '30%' }}>
              <div className={classes.infoLabel}>
                <Typography color="textSecondary" variant="body2">
                  Funding Payments
                </Typography>
                <Tooltip title={'Funding happens every time the contract is touched'}>
                  <InfoIcon fontSize="small" className={classes.infoIcon} />
                </Tooltip>
              </div>
              <Typography>Continuous</Typography>
            </div>
            <div className={classes.infoItem} style={{ width: '15%' }}></div>
            <div className={classes.infoItem} style={{ width: '5%' }}></div>
          </div>
        </div>
        <div>
          <div className={classes.squeethInfoSubGroup}>
            {/* hard coded width layout to align with the prev line */}
            {!showAdvanced ? (
              <>
                <div className={classes.infoItem}>
                  <div className={classes.infoLabel}>
                    <Typography color="textSecondary" variant="body2">
                      Advanced details
                    </Typography>
                  </div>
                </div>
                <IconButton className={classes.arrowBtn} onClick={() => setShowAdvanced(true)}>
                  <ExpandMoreIcon />
                </IconButton>
              </>
            ) : (
              <>
                <div className={classes.infoItem} style={{ width: '18%' }}>
                  <div className={classes.infoLabel}>
                    <Typography color="textSecondary" variant="body2">
                      ETH&sup2; Price
                    </Typography>
                  </div>
                  <Typography>${Number(toTokenAmount(index, 18).toFixed(0)).toLocaleString()}</Typography>
                </div>
                <div className={classes.infoItem} style={{ width: '30%' }}>
                  <div className={classes.infoLabel}>
                    <Typography color="textSecondary" variant="body2">
                      Mark Price
                    </Typography>
                  </div>
                  <Typography>${Number(toTokenAmount(mark, 18).toFixed(0)).toLocaleString()}</Typography>
                </div>
                <div className={classes.infoItem} style={{ width: '25%' }}>
                  <div className={classes.infoLabel}>
                    <Typography color="textSecondary" variant="body2">
                      Implied Volatility
                    </Typography>
                  </div>
                  <Typography>{(impliedVol * 100).toFixed(2)}%</Typography>
                </div>
                <div className={classes.infoItem} style={{ width: '15%' }}>
                  <div className={classes.infoLabel}>
                    <Typography color="textSecondary" variant="body2">
                      Funding
                    </Typography>
                    <Tooltip
                      title={
                        actualTradeType === TradeType.LONG
                          ? 'Funding is paid out of your position'
                          : 'Funding is paid continuously to you from oSQTH token holders'
                      }
                    >
                      <InfoIcon fontSize="small" className={classes.infoIcon} />
                    </Tooltip>
                  </div>
                  <Typography>In-Kind</Typography>
                </div>
                <div className={classes.infoItem}>
                  <IconButton className={classes.arrowBtn} onClick={() => setShowAdvanced(false)}>
                    <ExpandLessIcon />
                  </IconButton>
                </div>
                {/*  */}
                {/* <div className={classes.infoItem}></div> */}
              </>
            )}
          </div>
        </div>
      </div>
    )
  }, [
    actualTradeType,
    classes.infoIcon,
    classes.infoItem,
    classes.infoLabel,
    classes.squeethInfo,
    classes.squeethInfoSubGroup,
    classes.arrowBtn,
    ethPrice.toNumber(),
    fundingPerDay,
    showAdvanced,
    impliedVol.toString(),
    ethPrice.toString(),
    mark.toString(),
    index.toString(),
  ])

  const Header = useCallback(() => {
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
                <>Covered Short Squeeth - short ETH&sup2; Position</>
              )}
            </Typography>
            <Typography className={classes.logoSubTitle} variant="body1" color="textSecondary">
              {tradeType === TradeType.LONG ? (
                <>Perpetual leverage without liquidations</>
              ) : (
                <>Earn funding for selling ETH collateralized squeeth;</>
              )}
            </Typography>
          </div>
        </div>
      </>
    )
  }, [classes.logoContainer, classes.logoTitle, tradeType])

  const TabComponent = useCallback(() => {
    return (
      <div>
        <SqueethTabs
          value={tradeType}
          onChange={(evt, val) => setTradeType(val)}
          aria-label="Sub nav tabs"
          className={classes.subNavTabs}
          centered
          classes={{ indicator: tradeType === TradeType.SHORT ? classes.shortIndicator : classes.longIndicator }}
        >
          <SqueethTab
            style={{ width: '50%', color: '#49D273' }}
            classes={{ root: classes.longTab, selected: classes.longTab }}
            label="Long"
          />
          <SqueethTab
            style={{ width: '50%', color: '#f5475c' }}
            classes={{ root: classes.shortTab, selected: classes.shortTab }}
            label="Short"
          />
        </SqueethTabs>
      </div>
    )
  }, [classes.subNavTabs, setTradeType, tradeType])

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
                <PositionCard />
              </div>
            </div>
            <div className={classes.tradeDetails}>
              {tradeType === TradeType.LONG ? (
                <>
                  <div className={classes.amountInput}>
                    <LongChart />
                  </div>
                </>
              ) : (
                <>
                  <div className={classes.amountInput}>
                    <VaultChart vault={Vaults.Short} longAmount={0} showPercentage={false} setCustomLong={() => null} />
                  </div>
                </>
              )}
            </div>
          </div>

          <div className={classes.ticket}>
            <TabComponent />
            <Card className={classes.innerTicket}>
              <Trade />
            </Card>
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
              <VaultChart vault={Vaults.Short} longAmount={0} showPercentage={false} setCustomLong={() => null} />
            )}
          </div>
          <div className={classes.mobileSpacer}>
            <PositionCard />
          </div>
        </div>
        <div className={classes.mobileAction}>
          <div style={{ width: '65%' }}>
            <TabComponent />
          </div>
          <PrimaryButton style={{ minWidth: '30%' }} onClick={() => setShowMobileTrade(true)}>
            Trade
          </PrimaryButton>
        </div>
        <MobileModal title="TRADE" isOpen={showMobileTrade} onClose={() => setShowMobileTrade(false)}>
          <TabComponent />
          <Card className={classes.innerTicket} style={{ textAlign: 'center', marginTop: '8px' }}>
            <Trade />
          </Card>
        </MobileModal>
      </Hidden>
    </div>
  )
}

export default function App() {
  return (
    <TradeProvider>
      <TradePage />
    </TradeProvider>
  )
}
