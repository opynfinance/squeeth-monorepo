import { useState } from 'react'
import { Typography, Box, Tooltip } from '@material-ui/core'
import { makeStyles, createStyles } from '@material-ui/core/styles'
import { useAtomValue, useAtom } from 'jotai'
import { useResetAtom } from 'jotai/utils'
import InfoIcon from '@material-ui/icons/InfoOutlined'
import clsx from 'clsx'

import Nav from '@components/Nav'
import { WelcomeModal } from '@components/Trade/WelcomeModal'
import { ethTradeAmountAtom, sqthTradeAmountAtom, tradeTypeAtom } from '@state/trade/atoms'
import { isTransactionFirstStepAtom, transactionDataAtom, transactionLoadingAtom } from '@state/wallet/atoms'
import { LongChartPayoff } from '@components/Charts/LongChartPayoff'
import ShortFundingChart from '@components/Charts/ShortFundingChart'
import SqueethMetrics from '@components/Trade/SqueethMetrics'
import { SqueethTabNew, SqueethTabsNew } from '@components/Tabs'
import Trade from '@components/Trade'
import PositionCard from '@components/PositionCard'
import { TradeType } from 'src/types'
import { LinkWrapper } from '@components/LinkWrapper'

const useStyles = makeStyles((theme) =>
  createStyles({
    container: {
      maxWidth: '1280px',
      width: '80%',
      display: 'flex',
      justifyContent: 'center',
      gridGap: '96px',
      flexWrap: 'wrap',
      padding: theme.spacing(6, 5),
      margin: '0 auto',
      [theme.breakpoints.down('lg')]: {
        maxWidth: 'none',
        width: '90%',
      },
      [theme.breakpoints.down('md')]: {
        width: '100%',
        gridGap: '40px',
      },
      [theme.breakpoints.down('sm')]: {
        padding: theme.spacing(3, 4),
      },
      [theme.breakpoints.down('xs')]: {
        padding: theme.spacing(3, 3),
      },
    },
    leftColumn: {
      flex: 1,
      minWidth: '480px',
      [theme.breakpoints.down('xs')]: {
        minWidth: '320px',
      },
    },
    rightColumn: {
      flexBasis: '452px',
      [theme.breakpoints.down('xs')]: {
        flex: '1',
      },
    },
    title: {
      fontSize: '28px',
      fontWeight: 700,
      letterSpacing: '-0.02em',
    },
    tooltip: {
      marginLeft: theme.spacing(0.5),
    },
    infoIcon: {
      fontSize: '15px',
    },
    subtitle: {
      fontSize: '20px',
      fontWeight: 700,
      letterSpacing: '-0.01em',
    },
    description: {
      fontSize: '18px',
      fontWeight: 400,
      color: theme.palette.grey[400],
    },
    longIndicator: {
      background: theme.palette.success.light,
      borderRadius: theme.spacing(0.7),
    },
    shortIndicator: {
      background: theme.palette.error.light,
      borderRadius: theme.spacing(0.7),
    },
    longTab: {
      color: theme.palette.success.main,
    },
    shortTab: {
      color: theme.palette.error.main,
    },
    sectionMargin: {
      marginTop: theme.spacing(4),
    },
    tradeSection: {
      border: '1px solid #242728',
      boxShadow: '0px 4px 40px rgba(0, 0, 0, 0.25)',
      borderRadius: theme.spacing(0.7),
      padding: '32px 24px',
    },
  }),
)

const Header: React.FC = () => {
  const classes = useStyles()
  const tradeType = useAtomValue(tradeTypeAtom)

  if (tradeType === TradeType.LONG) {
    return (
      <>
        <Typography variant="h3" className={classes.title}>
          Long Squeeth: ETH&sup2; Leverage
          <a
            href="https://medium.com/opyn/squeeth-primer-a-guide-to-understanding-opyns-implementation-of-squeeth-a0f5e8b95684"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Tooltip
              className={classes.tooltip}
              title={
                <>
                  {'Learn more about long squeeth '}
                  <LinkWrapper href="https://medium.com/opyn/squeeth-primer-a-guide-to-understanding-opyns-implementation-of-squeeth-a0f5e8b95684">
                    here
                  </LinkWrapper>
                </>
              }
            >
              <InfoIcon fontSize="small" className={classes.infoIcon} />
            </Tooltip>
          </a>
        </Typography>
        <Typography variant="subtitle1" className={classes.description}>
          Perpetual leverage without liquidations
        </Typography>
      </>
    )
  } else {
    return (
      <>
        <Typography variant="h3" className={classes.title}>
          Covered Short Squeeth: Short ETH&sup2; Position
          <a
            href="https://medium.com/opyn/squeeth-primer-a-guide-to-understanding-opyns-implementation-of-squeeth-a0f5e8b95684"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Tooltip
              className={classes.tooltip}
              title={
                <>
                  {'Learn more about short squeeth '}
                  <LinkWrapper href="https://medium.com/opyn/squeeth-primer-a-guide-to-understanding-opyns-implementation-of-squeeth-a0f5e8b95684">
                    here
                  </LinkWrapper>
                </>
              }
            >
              <InfoIcon fontSize="small" className={classes.infoIcon} />
            </Tooltip>
          </a>
        </Typography>
        <Typography variant="subtitle1" className={classes.description}>
          Earn premiums for selling ETH collateralized squeeth
        </Typography>
      </>
    )
  }
}

const TabComponent: React.FC = () => {
  const [tradeType, setTradeType] = useAtom(tradeTypeAtom)
  const resetEthTradeAmount = useResetAtom(ethTradeAmountAtom)
  const resetSqthTradeAmount = useResetAtom(sqthTradeAmountAtom)
  const resetTransactionData = useResetAtom(transactionDataAtom)
  const transactionInProgress = useAtomValue(transactionLoadingAtom)
  const isTxFirstStep = useAtomValue(isTransactionFirstStepAtom)

  const classes = useStyles()

  return (
    <div>
      <SqueethTabsNew
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
        centered
        variant="fullWidth"
        classes={{ indicator: tradeType === TradeType.SHORT ? classes.shortIndicator : classes.longIndicator }}
      >
        <SqueethTabNew label="Long" id="long-card-btn" classes={{ root: classes.longTab }} />
        <SqueethTabNew label="Short" id="short-card-btn" classes={{ root: classes.shortTab }} />
      </SqueethTabsNew>
    </div>
  )
}

function TradePage() {
  const classes = useStyles()
  const [isWelcomeModalOpen, setWelcomeModalOpen] = useState(false)
  const tradeType = useAtomValue(tradeTypeAtom)

  const handleClose = () => setWelcomeModalOpen(false)

  return (
    <>
      <div>
        <Nav />

        <Box className={classes.container}>
          <Box className={classes.leftColumn}>
            <Header />

            <div className={classes.sectionMargin}>
              {tradeType === TradeType.LONG ? <LongChartPayoff /> : <ShortFundingChart />}
            </div>

            <Box marginTop="76px">
              <PositionCard />
            </Box>

            <Box marginTop="40px">
              <Typography variant="h4" className={classes.subtitle}>
                Details
              </Typography>

              <SqueethMetrics marginTop="16px" />
            </Box>
          </Box>

          <Box className={classes.rightColumn}>
            <TabComponent />

            <div className={clsx(classes.sectionMargin, classes.tradeSection)}>
              <Typography variant="h4" className={classes.subtitle}>
                Position
              </Typography>

              <Trade marginTop="16px" />
            </div>
          </Box>
        </Box>
      </div>

      <WelcomeModal open={isWelcomeModalOpen} handleClose={handleClose} />
    </>
  )
}

export default TradePage
