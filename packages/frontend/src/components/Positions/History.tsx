import { createStyles, IconButton, makeStyles, Typography } from '@material-ui/core'
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
import useCommonStyles from './useStyles'
import { formatCurrency, formatNumber } from '@utils/formatter'

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
      backgroundColor: `${theme.palette.background.paper}40`,
      marginTop: theme.spacing(2),
      borderRadius: theme.spacing(1),
      display: 'flex',
      justifyContent: 'space-between',
    },
    txItemCol: {
      width: '30%',
    },
    txItemVal: {
      width: '30%',
    },
  }),
)

const History: React.FC = () => {
  const { transactions, loading } = useTransactionHistory()
  const networkId = useAtomValue(networkIdAtom)
  const ethPrice = useETHPrice()
  const normalizationFactor = useAtomValue(normFactorAtom)

  const classes = useStyles()
  const commonClasses = useCommonStyles()
  const { getUsdAmt } = useUsdAmount()

  if (loading) {
    return (
      <div className={classes.container}>
        <Typography variant="body1">loading...</Typography>
      </div>
    )
  }

  if (transactions.length === 0) {
    return (
      <div className={classes.container}>
        <Typography variant="body1">No transactions found</Typography>
      </div>
    )
  }

  return (
    <div className={classes.container}>
      {transactions.map((tx, index) => (
        <div className={classes.historyItem} key={tx.timestamp + index}>
          <div className={classes.txItemCol}>
            <Typography variant="body2">{tx.transactionType}</Typography>
            <Typography variant="caption" color="textSecondary" className={commonClasses.textMonospace}>
              {new Date(Number(tx.timestamp) * 1000).toDateString()}
            </Typography>
          </div>
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
                      {formatNumber(tx.squeethAmount.toNumber(), 6)} oSQTH
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

          <div>
            <IconButton size="small" href={`${EtherscanPrefix[networkId]}/${tx.txId}`} target="_blank">
              <OpenInNewIcon style={{ fontSize: '16px' }} color="secondary" />
            </IconButton>
          </div>
        </div>
      ))}
    </div>
  )
}

export default History
