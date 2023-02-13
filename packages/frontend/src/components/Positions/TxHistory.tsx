import { createStyles, makeStyles, Typography, useTheme, useMediaQuery, IconButton } from '@material-ui/core'
import OpenInNewIcon from '@material-ui/icons/OpenInNew'
import { useAtomValue } from 'jotai'
import clsx from 'clsx'

import { EtherscanPrefix } from '@constants/index'
import { TransactionType } from '@constants/enums'
import { useTransactionHistory } from '@hooks/useTransactionHistory'
import { useUsdAmount } from '@hooks/useUsdAmount'
import { networkIdAtom } from '@state/wallet/atoms'
import { useETHPrice } from '@hooks/useETHPrice'
import { normFactorAtom } from '@state/controller/atoms'
import { formatCurrency, formatNumber } from '@utils/formatter'
import useCommonStyles from './useStyles'

const useStyles = makeStyles((theme) =>
  createStyles({
    container: {
      marginTop: theme.spacing(2),
      marginBottom: theme.spacing(5),
    },
    tableCell: {
      width: '10px',
    },
    red: {
      color: theme.palette.error.main,
    },
    green: {
      color: theme.palette.success.main,
    },
    txTypeContainer: {
      display: 'flex',
      alignItems: 'center',
    },
    historyItem: {
      padding: theme.spacing(2),
      backgroundColor: theme.palette.background.stone,
      marginTop: theme.spacing(2),
      borderRadius: theme.spacing(1),
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      flexWrap: 'wrap',
      width: '100%',
      gridGap: '12px',
    },
    itemHeaderCol: {
      flexBasis: '30%',
      [theme.breakpoints.down('xs')]: {
        flexBasis: '100%',
        marginBottom: theme.spacing(1),
      },
    },
    itemDataCol: {
      flex: 1,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gridGap: '12px',
    },
    txItemVal: {
      flexBasis: '120px',
      flex: 1,
    },
    txItemCTA: {
      textAlign: 'right',
      flexBasis: '144px',

      [theme.breakpoints.down('xs')]: {
        flexBasis: '40px',
      },
    },
    ctaButton: {
      '&:hover': {
        backgroundColor: 'transparent',
      },
    },
  }),
)

const TxHistory: React.FC = () => {
  const { transactions, loading } = useTransactionHistory()
  const networkId = useAtomValue(networkIdAtom)
  const ethPrice = useETHPrice()
  const normalizationFactor = useAtomValue(normFactorAtom)

  const { getUsdAmt } = useUsdAmount()

  const theme = useTheme()
  const classes = useStyles()
  const commonClasses = useCommonStyles()
  const isMobileBreakpoint = useMediaQuery(theme.breakpoints.down('xs'))

  if (loading) {
    return (
      <Typography variant="body1" color="textSecondary">
        loading...
      </Typography>
    )
  }

  if (transactions.length === 0) {
    return (
      <Typography variant="body1" color="textSecondary">
        No transaction found.
      </Typography>
    )
  }

  return (
    <>
      {transactions.map((tx, index) => (
        <div className={classes.historyItem} key={tx.timestamp + index}>
          <div className={classes.itemHeaderCol}>
            <Typography variant="body2" className={commonClasses.fontMedium}>
              {tx.transactionType}
            </Typography>
            <Typography variant="caption" color="textSecondary" className={commonClasses.textMonospace}>
              {new Date(Number(tx.timestamp) * 1000).toDateString()}
            </Typography>
          </div>

          <div className={classes.itemDataCol}>
            {tx.transactionType === TransactionType.CRAB_FLASH_DEPOSIT ||
            tx.transactionType === TransactionType.CRAB_FLASH_WITHDRAW ||
            tx.transactionType === TransactionType.BULL_FLASH_DEPOSIT ||
            tx.transactionType === TransactionType.BULL_FLASH_WITHDRAW ? (
              <>
                <div className={classes.txItemVal}>
                  <Typography
                    variant="body2"
                    className={clsx(
                      commonClasses.textMonospace,
                      tx.transactionType === TransactionType.CRAB_FLASH_WITHDRAW ||
                        tx.transactionType === TransactionType.BULL_FLASH_WITHDRAW
                        ? classes.red
                        : classes.green,
                    )}
                  >
                    {formatNumber(tx.ethAmount.toNumber(), 4)} WETH
                  </Typography>
                  <Typography variant="caption" color="textSecondary" className={commonClasses.textMonospace}>
                    {formatCurrency(getUsdAmt(tx.ethAmount, tx.timestamp).toNumber())}
                  </Typography>
                </div>
                <div className={classes.txItemVal} />
              </>
            ) : (
              <>
                <div className={classes.txItemVal}>
                  {tx.transactionType != TransactionType.OTC_DEPOSIT &&
                  tx.transactionType != TransactionType.OTC_WITHDRAW ? (
                    <>
                      <Typography
                        variant="body2"
                        className={clsx(
                          commonClasses.textMonospace,
                          tx.transactionType === TransactionType.BUY ||
                            tx.transactionType === TransactionType.BURN_SHORT ||
                            tx.transactionType === TransactionType.REMOVE_LIQUIDITY
                            ? classes.green
                            : classes.red,
                        )}
                      >
                        {formatNumber(tx.squeethAmount.toNumber(), 4)} oSQTH
                      </Typography>
                      <Typography variant="caption" color="textSecondary" className={commonClasses.textMonospace}>
                        {formatCurrency(
                          tx.squeethAmount
                            .times(ethPrice)
                            .times(ethPrice)
                            .div(10000)
                            .times(normalizationFactor)
                            .toNumber(),
                        )}
                      </Typography>
                    </>
                  ) : null}
                </div>
                <div className={classes.txItemVal}>
                  <Typography
                    variant="body2"
                    className={clsx(
                      commonClasses.textMonospace,
                      tx.transactionType === TransactionType.BUY ||
                        tx.transactionType === TransactionType.BURN_SHORT ||
                        tx.transactionType === TransactionType.ADD_LIQUIDITY
                        ? classes.red
                        : classes.green,
                    )}
                  >
                    {tx.transactionType === TransactionType.CRAB_V2_USDC_FLASH_DEPOSIT ||
                    tx.transactionType === TransactionType.CRAB_V2_USDC_FLASH_WITHDRAW
                      ? `${formatNumber(tx.usdValue.toNumber(), 2)} USDC`
                      : `${formatNumber(tx.ethAmount.toNumber(), 4)} WETH`}
                  </Typography>
                  <Typography variant="caption" color="textSecondary" className={commonClasses.textMonospace}>
                    {tx.transactionType === TransactionType.CRAB_V2_USDC_FLASH_DEPOSIT ||
                    tx.transactionType === TransactionType.CRAB_V2_USDC_FLASH_WITHDRAW
                      ? `${formatNumber(tx.ethAmount.toNumber(), 4)} WETH`
                      : `${formatCurrency(tx.usdValue.toNumber())}`}
                  </Typography>
                </div>
              </>
            )}

            <div className={classes.txItemCTA}>
              <IconButton
                size="small"
                href={`${EtherscanPrefix[networkId]}/${tx.txId}`}
                target="_blank"
                className={classes.ctaButton}
              >
                {!isMobileBreakpoint && (
                  <Typography variant="body2" color="primary" component="span">
                    View Transaction
                  </Typography>
                )}
                <OpenInNewIcon style={{ fontSize: '16px', marginLeft: '8px' }} color="primary" />
              </IconButton>
            </div>
          </div>
        </div>
      ))}
    </>
  )
}

export default TxHistory
