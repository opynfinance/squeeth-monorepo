import { CircularProgress, createStyles, makeStyles, Typography, Box, Collapse } from '@material-ui/core'
import BigNumber from 'bignumber.js'
import { useAtom, useAtomValue } from 'jotai'
import { useResetAtom, useUpdateAtom } from 'jotai/utils'
import React, { useState } from 'react'

import { PrimaryButtonNew } from '@components/Button'
import { InputToken } from '@components/InputNew'
import Alert from '@components/Alert'
import useAppCallback from '@hooks/useAppCallback'
import useAppEffect from '@hooks/useAppEffect'
import { useShutdownLongHelper } from '@hooks/contracts/useLongHelper'
import useAmplitude from '@hooks/useAmplitude'
import { LONG_SQUEETH_EVENTS } from '@utils/amplitude'

import { addressesAtom } from '@state/positions/atoms'

import {
  confirmedAmountAtom,
  ethTradeAmountAtom,
  sqthTradeAmountAtom,
  tradeCompletedAtom,
  tradeSuccessAtom,
} from '@state/trade/atoms'
import { connectedWalletAtom, isTransactionFirstStepAtom, supportedNetworkAtom } from '@state/wallet/atoms'
import { useSelectWallet, useTransactionStatus } from '@state/wallet/hooks'
import { OSQUEETH_DECIMALS } from '@constants/index'
import { formatNumber } from '@utils/formatter'
import osqthLogo from 'public/images/osqth-logo.svg'
import Cancelled from '../Cancelled'
import Confirmed, { ConfirmType } from '../Confirmed'
import Metric from '@components/Metric'
import RestrictionInfo from '@components/RestrictionInfo'
import { useRestrictUser } from '@context/restrict-user'
import { useGetOSqthSettlementAmount } from '@state/controller/hooks'
import { useTokenBalance } from '@hooks/contracts/useTokenBalance'

const useStyles = makeStyles((theme) =>
  createStyles({
    header: {
      color: theme.palette.primary.main,
    },
    title: {
      fontSize: '20px',
      fontWeight: 700,
      letterSpacing: '-0.01em',
      marginBottom: '24px',
    },
    sectionTitle: {
      fontSize: '20px',
      fontWeight: 700,
      letterSpacing: '-0.01em',
      marginBottom: '16px',
    },
    body: {
      padding: theme.spacing(2, 12),
      margin: 'auto',
      display: 'flex',
      justifyContent: 'space-around',
    },
    subHeading: {
      color: theme.palette.text.secondary,
    },
    thirdHeading: {
      marginTop: theme.spacing(2),
      paddingLeft: theme.spacing(1),
      paddingRight: theme.spacing(1),
    },
    explainer: {
      marginTop: theme.spacing(2),
      paddingLeft: theme.spacing(1),
      paddingRight: theme.spacing(1),
      marginLeft: theme.spacing(1),
      width: '200px',
      justifyContent: 'left',
    },
    caption: {
      marginTop: theme.spacing(1),
      fontSize: '13px',
    },
    divider: {
      margin: theme.spacing(2, 0),
      width: '300px',
      marginLeft: 'auto',
      marginRight: 'auto',
    },
    details: {
      marginTop: theme.spacing(4),
      width: '65%',
    },
    buyCard: {
      marginTop: theme.spacing(4),
      marginLeft: theme.spacing(2),
    },
    cardTitle: {
      color: theme.palette.primary.main,
      marginTop: theme.spacing(4),
    },
    cardSubTxt: {
      color: theme.palette.text.secondary,
      lineHeight: '1.75rem',
      fontSize: '16px',
      width: '90%',
    },
    payoff: {
      color: theme.palette.text.secondary,
      lineHeight: '1.75rem',
      fontSize: '16px',
    },
    cardDetail: {
      color: theme.palette.text.secondary,
      lineHeight: '1.75rem',
      fontSize: '16px',
      marginTop: theme.spacing(4),
    },
    amountInput: {
      backgroundColor: theme.palette.success.main,
      '&:hover': {
        backgroundColor: theme.palette.success.dark,
      },
    },
    innerCard: {
      textAlign: 'center',
      padding: theme.spacing(2),
      paddingBottom: theme.spacing(8),
      background: theme.palette.background.default,
      border: `1px solid ${theme.palette.background.stone}`,
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
    dialog: {
      padding: theme.spacing(2),
    },
    dialogHeader: {
      display: 'flex',
      alignItems: 'center',
    },
    dialogIcon: {
      marginRight: theme.spacing(1),
      color: theme.palette.warning.main,
    },
    txItem: {
      marginTop: theme.spacing(1),
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    },
    squeethExp: {
      display: 'flex',
      justifyContent: 'space-between',
      borderRadius: theme.spacing(1),
      padding: theme.spacing(1.5),
      width: '300px',
      marginLeft: 'auto',
      marginRight: 'auto',
      marginTop: theme.spacing(2),
      textAlign: 'left',
      backgroundColor: theme.palette.background.stone,
    },
    squeethExpTxt: {
      fontSize: '20px',
    },
    closePosition: {
      display: 'flex',
      justifyContent: 'space-between',
      padding: theme.spacing(0, 1),
    },
    closeBtn: {
      color: theme.palette.error.main,
    },
    paper: {
      backgroundColor: theme.palette.background.paper,
      boxShadow: theme.shadows[5],
      borderRadius: theme.spacing(1),
      width: '350px',
      textAlign: 'center',
      paddingBottom: theme.spacing(2),
    },
    modal: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    },
    buttonDiv: {
      position: 'sticky',
      bottom: '0',
      backgroundColor: theme.palette.background.default,
      zIndex: 1500,
    },
    hint: {
      display: 'flex',
      alignItems: 'center',
    },
    arrowIcon: {
      marginLeft: '4px',
      marginRight: '4px',
      fontSize: '20px',
    },
    hintTextContainer: {
      display: 'flex',
    },
    hintTitleText: {
      marginRight: '.5em',
    },
    linkHover: {
      '&:hover': {
        opacity: 0.7,
      },
    },
    anchor: {
      color: '#FF007A',
      fontSize: '16px',
    },
    settingsContainer: {
      display: 'flex',
      justify: 'space-between',
      alignItems: 'center',
    },
    settingsButton: {
      marginTop: theme.spacing(2),
      marginLeft: theme.spacing(10),
      justifyContent: 'right',
      alignSelf: 'center',
    },
    displayBlock: {
      display: 'block',
    },
    displayNone: {
      display: 'none',
    },
    lightStoneBackground: {
      backgroundColor: theme.palette.background.lightStone,
    },
    txStatus: {
      marginTop: theme.spacing(4),
    },
    labelContainer: {
      display: 'flex',
      alignItems: 'center',
      color: 'rgba(255, 255, 255, 0.5)',
    },
    label: {
      fontSize: '15px',
      fontWeight: 500,
      width: 'max-content',
    },
    infoIcon: {
      fontSize: '15px',
      marginLeft: theme.spacing(0.5),
    },
  }),
)

const RedeemLong: React.FC<BuyProps> = () => {
  const [isRedeemTxnLoading, setIsRedeemTxnLoading] = useState(false)
  const [isEthToReceiveLoading, setIsEthToReceiveLoading] = useState(false)
  const [ethToReceive, setEthToReceive] = useState<BigNumber>(new BigNumber(0))

  const classes = useStyles()
  const {
    cancelled,
    confirmed,
    loading: transactionInProgress,
    transactionData,
    resetTxCancelled,
    resetTransactionData,
  } = useTransactionStatus()

  const { oSqueeth, controller } = useAtomValue(addressesAtom)
  const { redeemLongHelper } = useShutdownLongHelper()

  const [confirmedAmount, setConfirmedAmount] = useAtom(confirmedAmountAtom)
  const setTradeSuccess = useUpdateAtom(tradeSuccessAtom)
  const setTradeCompleted = useUpdateAtom(tradeCompletedAtom)

  const { isRestricted, isWithdrawAllowed } = useRestrictUser()

  const supportedNetwork = useAtomValue(supportedNetworkAtom)
  const connected = useAtomValue(connectedWalletAtom)
  const selectWallet = useSelectWallet()
  const {
    value: oSqueethBalance,
    loading: isOSqueethBalanceLoading,
    refetch: refetchOSqueethBalance,
  } = useTokenBalance(oSqueeth, 30, OSQUEETH_DECIMALS)

  const getOSqthSettlementAmount = useGetOSqthSettlementAmount()

  const resetEthTradeAmount = useResetAtom(ethTradeAmountAtom)
  const resetSqthTradeAmount = useResetAtom(sqthTradeAmountAtom)

  const { track } = useAmplitude()

  useAppEffect(() => {
    if (transactionInProgress) {
      setIsRedeemTxnLoading(false)
    }
  }, [transactionInProgress])

  // Update the effect to handle loading state
  useAppEffect(() => {
    let mounted = true

    const fetchEthToReceive = async () => {
      if (oSqueethBalance.isGreaterThan(0)) {
        setIsEthToReceiveLoading(true)

        try {
          const settlementAmount = await getOSqthSettlementAmount(oSqueethBalance)
          if (mounted) {
            setEthToReceive(settlementAmount)
          }
        } catch (e) {
          console.log(e)
        } finally {
          if (mounted) {
            setIsEthToReceiveLoading(false)
          }
        }
      } else {
        if (mounted) {
          setEthToReceive(new BigNumber(0))
          setIsEthToReceiveLoading(false)
        }
      }
    }

    fetchEthToReceive()

    return () => {
      mounted = false
    }
  }, [oSqueethBalance.toString(), getOSqthSettlementAmount])

  const redeemLong = useAppCallback(async () => {
    setIsRedeemTxnLoading(true)
    try {
      track(LONG_SQUEETH_EVENTS.REDEEM_LONG_OSQTH_CLICK)

      await redeemLongHelper(oSqueethBalance, () => {
        setTradeSuccess(true)
        setTradeCompleted(true)
        setConfirmedAmount(oSqueethBalance.toFixed(6))
        resetEthTradeAmount()
        resetSqthTradeAmount()
        refetchOSqueethBalance()

        track(LONG_SQUEETH_EVENTS.REDEEM_LONG_OSQTH_SUCCESS, {
          amount: oSqueethBalance.toNumber(),
          ethReceived: ethToReceive.toNumber(),
        })
      })
    } catch (e) {
      console.log(e)
      setIsRedeemTxnLoading(false)
      track(LONG_SQUEETH_EVENTS.REDEEM_LONG_OSQTH_FAILED, {
        amount: oSqueethBalance.toNumber(),
      })
    }
  }, [
    oSqueethBalance?.toString(),
    resetEthTradeAmount,
    resetSqthTradeAmount,
    redeemLongHelper,
    setTradeCompleted,
    setTradeSuccess,
    setConfirmedAmount,
    ethToReceive?.toString(),
  ])

  // let openError: string | undefined
  let redeemError: string | undefined

  if (connected) {
    if (!isOSqueethBalanceLoading && oSqueethBalance.lte(0)) {
      redeemError = 'No position to redeem'
    }
  }

  return (
    <div id="redeem-long-card">
      {confirmed ? (
        <>
          <Confirmed
            confirmationMessage={`Redeemed ${confirmedAmount} Squeeth`}
            txnHash={transactionData?.hash ?? ''}
            confirmType={ConfirmType.TRADE}
          />
          <div className={classes.buttonDiv}>
            <PrimaryButtonNew
              fullWidth
              id="redeem-long-close-btn"
              variant="contained"
              onClick={() => {
                resetTransactionData()
              }}
            >
              {'Close'}
            </PrimaryButtonNew>
          </div>
        </>
      ) : cancelled ? (
        <>
          <Cancelled txnHash={transactionData?.hash ?? ''} />
          <div className={classes.buttonDiv}>
            <PrimaryButtonNew
              fullWidth
              variant="contained"
              onClick={() => {
                resetTransactionData()
                resetTxCancelled()
              }}
            >
              {'Close'}
            </PrimaryButtonNew>
          </div>
        </>
      ) : (
        <>
          <Typography variant="h4" className={classes.title}>
            Redeem oSQTH Position
          </Typography>

          <Box display="flex" flexDirection="column" gridGap="16px">
            <InputToken
              id="redeem-long-osqth-input"
              label="oSQTH position"
              value={oSqueethBalance.toString()}
              balance={oSqueethBalance}
              isBalanceLoading={isOSqueethBalanceLoading}
              symbol="oSQTH"
              logo={osqthLogo}
              showMaxAction={false}
              error={!!redeemError}
              helperText={redeemError}
              readOnly={true}
              readOnlyTooltip={'Only full redemption is allowed'}
            />
          </Box>

          <Collapse in={!!redeemError}>
            <Alert severity="error" marginTop="24px">
              {redeemError}
            </Alert>
          </Collapse>

          <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" marginTop="12px">
            <Metric
              label="ETH you will receive"
              value={isEthToReceiveLoading ? 'Loading...' : formatNumber(ethToReceive.toNumber(), 4) + ' ETH'}
              isSmall
              flexDirection="row"
              justifyContent="space-between"
              gridGap="12px"
            />
          </Box>

          {isRestricted && <RestrictionInfo withdrawAllowed={isWithdrawAllowed} marginTop="24px" />}

          <Box marginTop="24px" className={classes.buttonDiv}>
            {isRestricted && !isWithdrawAllowed ? (
              <PrimaryButtonNew
                fullWidth
                variant="contained"
                onClick={selectWallet}
                disabled={true}
                id="redeem-long-restricted-btn"
              >
                {'Unavailable'}
              </PrimaryButtonNew>
            ) : !connected ? (
              <PrimaryButtonNew
                fullWidth
                variant="contained"
                onClick={selectWallet}
                disabled={!!isRedeemTxnLoading}
                id="redeem-long-connect-wallet-btn"
              >
                {'Connect Wallet'}
              </PrimaryButtonNew>
            ) : (
              <PrimaryButtonNew
                fullWidth
                onClick={redeemLong}
                disabled={
                  !supportedNetwork ||
                  isOSqueethBalanceLoading ||
                  isRedeemTxnLoading ||
                  transactionInProgress ||
                  !!redeemError ||
                  oSqueethBalance.isZero() ||
                  isEthToReceiveLoading
                }
                id="redeem-long-submit-tx-btn"
              >
                {!supportedNetwork ? (
                  'Unsupported Network'
                ) : isOSqueethBalanceLoading || isRedeemTxnLoading || transactionInProgress || isEthToReceiveLoading ? (
                  <CircularProgress color="primary" size="1.5rem" />
                ) : (
                  'Redeem oSQTH'
                )}
              </PrimaryButtonNew>
            )}
          </Box>
        </>
      )}
    </div>
  )
}

type BuyProps = {
  open?: boolean
  isLPage?: boolean
  activeStep?: number
  showTitle?: boolean
}

const Long: React.FC<BuyProps> = ({ open, isLPage = false, activeStep = 0, showTitle = true }) => {
  return <RedeemLong isLPage={isLPage} activeStep={activeStep} showTitle={showTitle} />
}

export default Long
