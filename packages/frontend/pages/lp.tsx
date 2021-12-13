import { createStyles, makeStyles, Tooltip } from '@material-ui/core'
import Typography from '@material-ui/core/Typography'
import InfoIcon from '@material-ui/icons/InfoOutlined'
import BigNumber from 'bignumber.js'
import Image from 'next/image'
import React, { useCallback, useState } from 'react'

import squeethTokenSymbol from '../public/images/Squeeth.png'
import { LPTable } from '../src/components/Lp/LPTable'
import ObtainSqueeth from '../src/components/Lp/ObtainSqueeth'
import { LPActionTabs } from '../src/components/LPActionTabs'
import Nav from '../src/components/Nav'
import { Tooltips } from '../src/constants/enums'
import { LPProvider } from '../src/context/lp'
import { TradeProvider } from '../src/context/trade'
import { useController } from '../src/hooks/contracts/useController'
import { useSqueethPool } from '../src/hooks/contracts/useSqueethPool'
import { useETHPrice } from '../src/hooks/useETHPrice'
import { toTokenAmount } from '../src/utils/calculations'
import { withRequiredAddr } from '../src/utils/withRequiredAddr'

const useStyles = makeStyles((theme) =>
  createStyles({
    container: {
      height: 'calc(100vh - 64px)',
      maxHeight: '1000px',
      padding: theme.spacing(4),
      maxWidth: '1600px',
    },
    logoContainer: {
      display: 'flex',
      alignItems: 'center',
      width: '100%',
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
    innerTicket: {
      background: theme.palette.background.lightStone,
      overflow: 'auto',
    },
    squeethInfo: {
      [theme.breakpoints.down('sm')]: {
        width: '100%',
        marginTop: theme.spacing(2),
      },
      marginLeft: theme.spacing(10),
    },
    squeethInfoSubGroup: {
      display: 'flex',
      // marginTop: theme.spacing(2),
      // marginBottom: theme.spacing(2),
      alignItems: 'center',
    },
    infoItem: {
      marginRight: theme.spacing(1),
      paddingRight: theme.spacing(1.5),
    },
    infoLabel: {
      display: 'flex',
      alignItems: 'center',
    },
    infoIcon: {
      fontSize: '14px',
      marginLeft: theme.spacing(0.5),
    },
  }),
)

export function LPCalculator() {
  const [amount, setAmount] = useState(new BigNumber(0))
  const [collatAmount, setCollatAmount] = useState(new BigNumber(0))
  const [collatPercent, setCollatPercent] = useState(200)
  const [withdrawCollat, setWithdrawCollat] = useState(new BigNumber(0))
  const [mintAmount, setMintAmount] = useState(new BigNumber(0))
  const [loading, setLoading] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [txHash, setTxHash] = useState('')
  const [step, setStep] = useState(0)

  const classes = useStyles()
  const { pool, getWSqueethPositionValue, tvl } = useSqueethPool()

  const ethPrice = useETHPrice()
  const { mark, index, impliedVol } = useController()

  const SqueethInfo = useCallback(() => {
    return (
      <div className={classes.squeethInfo}>
        <div>
          <div className={classes.squeethInfoSubGroup}>
            {/* hard coded width layout to align with the next line */}
            <div className={classes.infoItem}>
              <Typography color="textSecondary" variant="body2">
                ETH Price
              </Typography>
              <Typography>${ethPrice.toNumber().toLocaleString()}</Typography>
            </div>
            <div className={classes.infoItem}>
              <div className={classes.infoLabel}>
                <Typography color="textSecondary" variant="body2">
                  ETH&sup2; Price
                </Typography>
              </div>
              <Typography>${Number(toTokenAmount(index, 18).toFixed(0)).toLocaleString()}</Typography>
            </div>
            <div className={classes.infoItem}>
              <div className={classes.infoLabel}>
                <Typography color="textSecondary" variant="body2">
                  Mark Price
                </Typography>
                <Tooltip title={Tooltips.Mark}>
                  <InfoIcon fontSize="small" className={classes.infoIcon} />
                </Tooltip>
              </div>
              <Typography>${Number(toTokenAmount(mark, 18).toFixed(0)).toLocaleString()}</Typography>
            </div>
            <div className={classes.infoItem}>
              <div className={classes.infoLabel}>
                <Typography color="textSecondary" variant="body2">
                  oSQTH Price
                </Typography>
                <Tooltip title={Tooltips.oSQTHPrice}>
                  <InfoIcon fontSize="small" className={classes.infoIcon} />
                </Tooltip>
              </div>
              <Typography>${Number(getWSqueethPositionValue(1).toFixed(2).toLocaleString()) || 'loading'}</Typography>
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

            {/* <div className={classes.infoItem}>
              <div className={classes.infoLabel}>
                <Typography color="textSecondary" variant="body2">
                  Pool TVL
                </Typography>
              </div>
              <Typography>{tvl || 'loading'}%</Typography>
            </div> */}
          </div>
        </div>
      </div>
    )
  }, [
    classes.infoItem,
    classes.infoLabel,
    classes.squeethInfo,
    classes.squeethInfoSubGroup,
    ethPrice.toNumber(),
    impliedVol.toString(),
    ethPrice.toString(),
    mark.toString(),
    index.toString(),
  ])

  return (
    <div>
      <Nav />
      <div className={classes.container}>
        <div className={classes.logoContainer}>
          <div className={classes.logo}>
            <Image src={squeethTokenSymbol} alt="squeeth token" width={37} height={37} />
          </div>
          <div>
            <Typography variant="h5" className={classes.logoTitle}>
              Uniswap V3 LP SQTH-ETH Pool
            </Typography>
            <Typography className={classes.logoSubTitle} variant="body1" color="textSecondary">
              Earn LP fees for providing SQTH-ETH liquidity
            </Typography>
          </div>
          <SqueethInfo />
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            height: '78vh',
          }}
        >
          <LPTable isLPage={true} pool={pool}></LPTable>
          <ObtainSqueeth />
          {/* <LPActionTabs
            amount={amount}
            setAmount={setAmount}
            collatAmount={collatAmount}
            setCollatAmount={setCollatAmount}
            collatPercent={collatPercent}
            setCollatPercent={setCollatPercent}
            withdrawCollat={withdrawCollat}
            setWithdrawCollat={setWithdrawCollat}
            mintAmount={mintAmount}
            setMintAmount={setMintAmount}
            loading={loading}
            setLoading={setLoading}
            confirmed={confirmed}
            setConfirmed={setConfirmed}
            txHash={txHash}
            setTxHash={setTxHash}
          /> */}
        </div>
      </div>
    </div>
  )
}

export function LPage() {
  return (
    <TradeProvider>
      <LPProvider>
        <LPCalculator />
      </LPProvider>
    </TradeProvider>
  )
}

export default withRequiredAddr(LPage)
