import { CircularProgress, createStyles, makeStyles, Typography, Box, Collapse } from '@material-ui/core'
import BigNumber from 'bignumber.js'
import { useAtom, useAtomValue } from 'jotai'
import { useResetAtom, useUpdateAtom } from 'jotai/utils'
import React, { useState, useMemo } from 'react'

import { PrimaryButtonNew } from '@components/Button'
import { InputToken } from '@components/InputNew'
import Alert from '@components/Alert'
import { useUserAllowance } from '@hooks/contracts/useAllowance'
import useAppCallback from '@hooks/useAppCallback'
import useAppEffect from '@hooks/useAppEffect'
import { useOSQTHPrice } from '@hooks/useOSQTHPrice'
import { useShutdownLongHelper } from '@hooks/contracts/useLongHelper'
import useAmplitude from '@hooks/useAmplitude'
import { LONG_SQUEETH_EVENTS } from '@utils/amplitude'

import { addressesAtom } from '@state/positions/atoms'

import {
  confirmedAmountAtom,
  ethTradeAmountAtom,
  inputQuoteLoadingAtom,
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
  const [hasJustApprovedSqueeth, setHasJustApprovedSqueeth] = useState(false)

  const classes = useStyles()
  const {
    cancelled,
    confirmed,
    loading: transactionInProgress,
    transactionData,
    resetTxCancelled,
    resetTransactionData,
  } = useTransactionStatus()

  const [ethToReceive, setEthToReceive] = useState<BigNumber>(new BigNumber(0))
  const { oSqueeth, controller } = useAtomValue(addressesAtom)
  const { redeemLongHelper } = useShutdownLongHelper()

  const [confirmedAmount, setConfirmedAmount] = useAtom(confirmedAmountAtom)
  const [inputQuoteLoading, setInputQuoteLoading] = useAtom(inputQuoteLoadingAtom)
  const setTradeSuccess = useUpdateAtom(tradeSuccessAtom)
  const setTradeCompleted = useUpdateAtom(tradeCompletedAtom)

  const { allowance: squeethAllowance, approve: squeethApprove } = useUserAllowance(oSqueeth, controller)
  const [isTxFirstStep, setIsTxFirstStep] = useAtom(isTransactionFirstStepAtom)
  const { isRestricted, isWithdrawAllowed } = useRestrictUser()

  const supportedNetwork = useAtomValue(supportedNetworkAtom)
  const connected = useAtomValue(connectedWalletAtom)
  const selectWallet = useSelectWallet()
  const { value: oSqueethBalance } = useTokenBalance(oSqueeth, 30, OSQUEETH_DECIMALS)

  const getOSqthSettlementAmount = useGetOSqthSettlementAmount()

  const resetEthTradeAmount = useResetAtom(ethTradeAmountAtom)
  const resetSqthTradeAmount = useResetAtom(sqthTradeAmountAtom)

  const { track } = useAmplitude()

  // let openError: string | undefined
  let redeemError: string | undefined

  if (connected) {
    if (oSqueethBalance.lte(0)) {
      redeemError = 'No position to redeem'
    }
  }

  useAppEffect(() => {
    if (transactionInProgress) {
      setIsRedeemTxnLoading(false)
    }
  }, [transactionInProgress])

  useAppEffect(() => {
    if (oSqueethBalance.isGreaterThan(0)) {
      setInputQuoteLoading(true)

      getOSqthSettlementAmount(oSqueethBalance)
        .then((settlementAmount) => {
          setEthToReceive(settlementAmount)
          setInputQuoteLoading(false)
        })
        .catch((e) => {
          console.log(e)
          setInputQuoteLoading(false)
        })
    }
  }, [oSqueethBalance.toString(), getOSqthSettlementAmount, setInputQuoteLoading])

  const needsSqueethApproval = useMemo(
    () => squeethAllowance.lt(oSqueethBalance) && !hasJustApprovedSqueeth,
    [squeethAllowance?.toString(), oSqueethBalance?.toString(), hasJustApprovedSqueeth],
  )

  const redeemLong = useAppCallback(async () => {
    setIsRedeemTxnLoading(true)
    try {
      if (needsSqueethApproval) {
        track(LONG_SQUEETH_EVENTS.APPROVE_LONG_OSQTH_CLICK)
        setIsTxFirstStep(true)
        await squeethApprove(() => {
          setHasJustApprovedSqueeth(true)
          setIsRedeemTxnLoading(false)
          track(LONG_SQUEETH_EVENTS.APPROVE_LONG_OSQTH_SUCCESS)
        })
      } else {
        track(LONG_SQUEETH_EVENTS.REDEEM_LONG_OSQTH_CLICK)

        await redeemLongHelper(oSqueethBalance, () => {
          setIsTxFirstStep(false)
          setTradeSuccess(true)
          setTradeCompleted(true)

          setConfirmedAmount(oSqueethBalance.toFixed(6))

          resetEthTradeAmount()
          resetSqthTradeAmount()

          track(LONG_SQUEETH_EVENTS.REDEEM_LONG_OSQTH_SUCCESS, {
            amount: oSqueethBalance.toNumber(),
            ethReceived: ethToReceive.toNumber(),
          })
        })
      }
    } catch (e) {
      console.log(e)
      setIsRedeemTxnLoading(false)

      // Track failures
      if (needsSqueethApproval) {
        track(LONG_SQUEETH_EVENTS.APPROVE_LONG_OSQTH_FAILED)
      } else {
        track(LONG_SQUEETH_EVENTS.REDEEM_LONG_OSQTH_FAILED, {
          amount: oSqueethBalance.toNumber(),
        })
      }
    }
  }, [
    needsSqueethApproval,
    oSqueethBalance?.toString(),
    hasJustApprovedSqueeth,
    resetEthTradeAmount,
    resetSqthTradeAmount,
    redeemLongHelper,
    setIsTxFirstStep,
    setTradeCompleted,
    setTradeSuccess,
    squeethAllowance,
    squeethApprove,
    setConfirmedAmount,
  ])

  return (
    <div id="redeem-long-card">
      {confirmed && !isTxFirstStep ? (
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
              symbol="oSQTH"
              logo={osqthLogo}
              balance={oSqueethBalance}
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
              value={formatNumber(ethToReceive.toNumber()) + ' ETH'}
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
                  isRedeemTxnLoading ||
                  transactionInProgress ||
                  !!redeemError ||
                  oSqueethBalance.isZero() ||
                  inputQuoteLoading
                }
                id="redeem-long-submit-tx-btn"
              >
                {!supportedNetwork ? (
                  'Unsupported Network'
                ) : isRedeemTxnLoading || transactionInProgress || inputQuoteLoading ? (
                  <CircularProgress color="primary" size="1.5rem" />
                ) : squeethAllowance.lt(oSqueethBalance) && !hasJustApprovedSqueeth ? (
                  'Approve oSQTH (1/2)'
                ) : hasJustApprovedSqueeth ? (
                  'Redeem oSQTH (2/2)'
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
