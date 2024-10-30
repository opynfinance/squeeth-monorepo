import { makeStyles, createStyles } from '@material-ui/core/styles'
import { Box, Typography, CircularProgress, Collapse } from '@material-ui/core'
import BigNumber from 'bignumber.js'
import React, { memo, useState } from 'react'
import { useAtom, useAtomValue } from 'jotai'
import { atomWithStorage, useUpdateAtom } from 'jotai/utils'

import { useShutdownShortHelper } from '@hooks/contracts/useShortHelper'
import { useVaultManager } from '@hooks/contracts/useVaultManager'
import { PrimaryButtonNew } from '@components/Button'
import { InputToken } from '@components/InputNew'
import Alert from '@components/Alert'
import Confirmed, { ConfirmType } from '@components/Trade/Confirmed'
import { connectedWalletAtom, supportedNetworkAtom, addressAtom } from '@state/wallet/atoms'
import { useSelectWallet, useTransactionStatus } from '@state/wallet/hooks'
import { vaultHistoryUpdatingAtom } from '@state/positions/atoms'
import { useOSQTHPrice } from '@hooks/useOSQTHPrice'
import { useGetOSqthSettlementAmount, useGetUniNFTDetails } from '@state/controller/hooks'
import { useFirstValidVault } from '@state/positions/hooks'
import { tradeCompletedAtom, tradeSuccessAtom } from '@state/trade/atoms'
import Cancelled from '../Cancelled'
import useAppEffect from '@hooks/useAppEffect'
import useAppCallback from '@hooks/useAppCallback'
import { useVaultHistoryQuery } from '@hooks/useVaultHistory'
import Metric from '@components/Metric'
import osqthLogo from 'public/images/osqth-logo.svg'
import { formatNumber } from '@utils/formatter'
import RestrictionInfo from '@components/RestrictionInfo'
import { useRestrictUser } from '@context/restrict-user'
import useAmplitude from '@hooks/useAmplitude'
import { SHORT_SQUEETH_EVENTS } from '@utils/amplitude'

const useStyles = makeStyles((theme) =>
  createStyles({
    title: {
      fontSize: '20px',
      fontWeight: 700,
      letterSpacing: '-0.01em',
      marginBottom: '24px',
    },
    label: {
      fontSize: '18px',
      fontWeight: 700,
    },
    cardTitle: {
      color: theme.palette.primary.main,
      marginTop: theme.spacing(4),
    },
    cardHeader: {
      color: theme.palette.primary.main,
      marginTop: theme.spacing(2),
    },
    cardSubTxt: {
      color: theme.palette.text.secondary,
      lineHeight: '1.75rem',
      fontSize: '16px',
    },
    innerCard: {
      paddingBottom: theme.spacing(0),
    },
    amountInput: {
      backgroundColor: `${theme.palette.error.main}aa`,
      '&:hover': {
        backgroundColor: theme.palette.error.dark,
      },
    },
    thirdHeading: {
      marginTop: theme.spacing(2),
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
    txItem: {
      display: 'flex',
      padding: theme.spacing(0, 1),
      marginTop: theme.spacing(1),
      justifyContent: 'center',
      alignItems: 'center',
    },
    txLabel: {
      fontSize: '14px',
      color: theme.palette.text.secondary,
    },
    txUnit: {
      fontSize: '12px',
      color: theme.palette.text.secondary,
      marginLeft: theme.spacing(1),
    },
    infoIcon: {
      fontSize: '1rem',
      marginLeft: theme.spacing(0.5),
      color: theme.palette.text.secondary,
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
    divider: {
      margin: theme.spacing(2, 0),
      width: '300px',
      marginLeft: 'auto',
      marginRight: 'auto',
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
    settingsContainer: {
      display: 'flex',
      justify: 'space-between',
    },
    settingsButton: {
      marginTop: theme.spacing(2),
      marginLeft: theme.spacing(10),
      justifyContent: 'right',
    },
    formHelperText: {
      marginLeft: 0,
      marginRight: 0,
    },
    displayBlock: {
      display: 'block',
    },
    displayNone: {
      display: 'none',
    },
    vaultCollatInfo: {
      display: 'flex',
      alignItems: 'center',
      pointerEvents: 'auto',
    },
    select: {
      '&.MuiSelect-select:focus': {
        backgroundColor: 'transparent',
      },
    },
  }),
)

export const collatPercentAtom = atomWithStorage('collatPercent', 0)

const RedeemShort: React.FC<SellType> = () => {
  const [confirmedAmount, setConfirmedAmount] = useState('')
  const [existingCollatInETH, setExistingCollatInETH] = useState(new BigNumber(0))
  const [existingDebtInETH, setExistingDebtInETH] = useState(new BigNumber(0))

  // Add these new LP tracking variables
  const [lpedEth, setLpedEth] = useState(new BigNumber(0))
  const [lpedSqueethInEth, setLpedSqueethInEth] = useState(new BigNumber(0))
  const [lpedSqueethAmount, setLpedSqueethAmount] = useState(new BigNumber(0))

  const [shortAmount, setShortAmount] = useState(new BigNumber(0))
  const [isTxnLoading, setIsTxnLoading] = useState(false)

  const classes = useStyles()
  const {
    cancelled,
    confirmed,
    loading: transactionInProgress,
    transactionData,
    resetTransactionData,
    resetTxCancelled,
  } = useTransactionStatus()

  const { redeemShortPosition } = useShutdownShortHelper()
  const connected = useAtomValue(connectedWalletAtom)
  const supportedNetwork = useAtomValue(supportedNetworkAtom)
  const address = useAtomValue(addressAtom)

  const selectWallet = useSelectWallet()
  const getOSqthSettlementAmount = useGetOSqthSettlementAmount()
  const getUniNFTDetails = useGetUniNFTDetails()
  const setTradeCompleted = useUpdateAtom(tradeCompletedAtom)

  const setTradeSuccess = useUpdateAtom(tradeSuccessAtom)

  const { updateVault } = useVaultManager()
  const { validVault: vault, vaultId } = useFirstValidVault()

  const [isVaultHistoryUpdating, setVaultHistoryUpdating] = useAtom(vaultHistoryUpdatingAtom)
  const vaultHistoryQuery = useVaultHistoryQuery(Number(vaultId), isVaultHistoryUpdating)
  const { isRestricted, isWithdrawAllowed } = useRestrictUser()

  const { track } = useAmplitude()

  console.log({ address, vault, vaultId })

  useAppEffect(() => {
    if (vault) {
      const contractShort = vault?.shortAmount?.isFinite() ? vault?.shortAmount : new BigNumber(0)
      setShortAmount(contractShort)
    }
  }, [vault?.shortAmount])

  useAppEffect(() => {
    if (shortAmount.isEqualTo(0)) {
      setExistingCollatInETH(new BigNumber(0))
      setExistingDebtInETH(new BigNumber(0))
    }
  }, [shortAmount])

  useAppEffect(() => {
    if (vault && !shortAmount.isEqualTo(0)) {
      const collateralInETH: BigNumber = vault?.collateralAmount ?? new BigNumber(0)
      setExistingCollatInETH(collateralInETH)

      const shortAmount = vault.shortAmount ?? new BigNumber(0)
      getOSqthSettlementAmount(shortAmount).then((debt) => {
        setExistingDebtInETH(debt)
      })
    }
  }, [shortAmount, getOSqthSettlementAmount, vault])

  // fetch LP details
  useAppEffect(() => {
    const getLPValues = async () => {
      if (vault && Number(vault?.NFTCollateralId) !== 0) {
        try {
          const { ethAmount, squeethValueInEth, squeethAmount } = await getUniNFTDetails(Number(vault?.NFTCollateralId))
          setLpedEth(ethAmount)
          setLpedSqueethInEth(squeethValueInEth)
          setLpedSqueethAmount(squeethAmount)
        } catch (err) {
          console.error('Error getting LP values:', err)
          setLpedEth(new BigNumber(0))
          setLpedSqueethInEth(new BigNumber(0))
          setLpedSqueethAmount(new BigNumber(0))
        }
      } else {
        setLpedEth(new BigNumber(0))
        setLpedSqueethInEth(new BigNumber(0))
        setLpedSqueethAmount(new BigNumber(0))
      }
    }

    getLPValues()
  }, [vault?.NFTCollateralId])

  useAppEffect(() => {
    if (transactionInProgress) {
      setIsTxnLoading(false)
    }
  }, [transactionInProgress])

  const handleRedeemShort = useAppCallback(async () => {
    setIsTxnLoading(true)

    try {
      track(SHORT_SQUEETH_EVENTS.REDEEM_SHORT_OSQTH_CLICK)
      await redeemShortPosition(Number(vaultId), async () => {
        setConfirmedAmount(shortAmount.toFixed(6).toString())
        setTradeSuccess(true)
        setTradeCompleted(true)
        setShortAmount(new BigNumber(0))

        setVaultHistoryUpdating(true)
        updateVault()
        vaultHistoryQuery.refetch({ vaultId })

        track(SHORT_SQUEETH_EVENTS.REDEEM_SHORT_OSQTH_SUCCESS, {
          vaultId: Number(vaultId),
          ethReceived: ethToReceive.toNumber(),
        })
      })
    } catch (e) {
      console.log(e)
      setIsTxnLoading(false)

      track(SHORT_SQUEETH_EVENTS.REDEEM_SHORT_OSQTH_FAILED)
    }
  }, [
    shortAmount?.toString(),
    updateVault,
    redeemShortPosition,
    setConfirmedAmount,
    setTradeSuccess,
    setTradeCompleted,
    setShortAmount,
    setVaultHistoryUpdating,
    vaultHistoryQuery,
    vaultId,
    track,
  ])

  // Add these calculated variables
  const totalCollateralInEth = existingCollatInETH.plus(lpedEth)
  const remainingDebtInEth = lpedSqueethInEth.gte(existingDebtInETH)
    ? new BigNumber(0)
    : existingDebtInETH.minus(lpedSqueethInEth)
  const ethToReceive = totalCollateralInEth.minus(remainingDebtInEth)

  let redeemError: string | undefined

  if (connected) {
    if (shortAmount.lte(0)) {
      redeemError = 'No position to redeem'
    } else if (ethToReceive.lte(0)) {
      redeemError = `Insolvent vault. Your collateral (${formatNumber(
        totalCollateralInEth.toNumber(),
      )} ETH) is less than your debt (${formatNumber(
        remainingDebtInEth.toNumber(),
      )} ETH). You will not receive any ETH back.`
    }
  }

  return (
    <div id="redeem-short-card">
      {confirmed ? (
        <div>
          <Confirmed
            confirmationMessage={`Redeemed ${confirmedAmount} Squeeth Short Position`}
            txnHash={transactionData?.hash ?? ''}
            confirmType={ConfirmType.TRADE}
          />
          <div className={classes.buttonDiv}>
            <PrimaryButtonNew
              fullWidth
              variant="contained"
              onClick={() => {
                resetTransactionData()
              }}
              className={classes.amountInput}
              id="redeem-short-close-btn"
            >
              {'Close'}
            </PrimaryButtonNew>
          </div>
        </div>
      ) : cancelled ? (
        <div>
          <Cancelled txnHash={transactionData?.hash ?? ''} />
          <div className={classes.buttonDiv}>
            <PrimaryButtonNew
              fullWidth
              variant="contained"
              onClick={() => {
                resetTransactionData()
                resetTxCancelled()
              }}
              className={classes.amountInput}
            >
              {'Close'}
            </PrimaryButtonNew>
          </div>
        </div>
      ) : (
        <>
          <Typography variant="h4" className={classes.title}>
            Redeem Short oSQTH Position
          </Typography>

          <Box display="flex" flexDirection="column">
            <InputToken
              id="redeem-short-osqth-input"
              label="Short oSQTH position"
              value={shortAmount.toString()}
              symbol="oSQTH"
              logo={osqthLogo}
              balance={shortAmount}
              showMaxAction={false}
              error={!!redeemError}
              helperText={redeemError}
              readOnly={true}
              readOnlyTooltip={'Only full redemption is allowed'}
            />

            <Box
              display="flex"
              justifyContent="space-between"
              alignItems="center"
              gridGap="12px"
              marginTop="24px"
              flexWrap="wrap"
            >
              <Metric
                label="Current collateral"
                value={formatNumber(existingCollatInETH.isPositive() ? existingCollatInETH.toNumber() : 0) + ' ETH'}
                isSmall
              />
              <Metric
                label="Current debt"
                value={formatNumber(existingDebtInETH.isPositive() ? existingDebtInETH.toNumber() : 0) + ' ETH'}
                isSmall
              />
            </Box>

            {(lpedEth.isGreaterThan(0) || lpedSqueethAmount.isGreaterThan(0)) && (
              <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" marginTop="12px">
                <Metric
                  label="LP Position"
                  value={`${formatNumber(lpedEth.toNumber())} ETH + ${formatNumber(
                    lpedSqueethAmount.toNumber(),
                  )} oSQTH`}
                  isSmall
                />
              </Box>
            )}

            <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" marginTop="24px">
              <Metric
                label="ETH you will receive"
                value={formatNumber(existingCollatInETH.minus(existingDebtInETH).toNumber()) + ' ETH'}
              />
            </Box>

            <Collapse in={!!redeemError}>
              <Alert severity="error" marginTop="24px">
                {redeemError}
              </Alert>
            </Collapse>

            {isRestricted && <RestrictionInfo withdrawAllowed={isWithdrawAllowed} marginTop="24px" />}

            <Box marginTop="24px" className={classes.buttonDiv}>
              {isRestricted && !isWithdrawAllowed ? (
                <PrimaryButtonNew
                  fullWidth
                  variant="contained"
                  onClick={selectWallet}
                  disabled={true}
                  id="redeem-short-restricted-btn"
                >
                  {'Unavailable'}
                </PrimaryButtonNew>
              ) : !connected ? (
                <PrimaryButtonNew
                  fullWidth
                  variant="contained"
                  onClick={selectWallet}
                  className={classes.amountInput}
                  disabled={!!isTxnLoading}
                  id="redeem-short-connect-wallet-btn"
                >
                  {'Connect Wallet'}
                </PrimaryButtonNew>
              ) : (
                <PrimaryButtonNew
                  fullWidth
                  onClick={handleRedeemShort}
                  className={classes.amountInput}
                  disabled={
                    !supportedNetwork ||
                    isTxnLoading ||
                    transactionInProgress ||
                    !!redeemError ||
                    (vault && vault.shortAmount.isZero())
                  }
                  id="redeem-short-submit-tx-btn"
                >
                  {!supportedNetwork ? (
                    'Unsupported Network'
                  ) : isTxnLoading || transactionInProgress ? (
                    <CircularProgress color="primary" size="1.5rem" />
                  ) : (
                    'Redeem Short Position'
                  )}
                </PrimaryButtonNew>
              )}
            </Box>
          </Box>
        </>
      )}
    </div>
  )
}

type SellType = {
  open: boolean
}

const Short: React.FC<SellType> = ({ open }) => {
  return <RedeemShort open={open} />
}

export default memo(Short)
