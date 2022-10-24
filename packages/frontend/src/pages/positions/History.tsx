import { createStyles, IconButton, makeStyles, Typography } from '@material-ui/core'
import OpenInNewIcon from '@material-ui/icons/OpenInNew'

import { EtherscanPrefix } from '../../constants'
import { TransactionType } from '@constants/enums'
import { useTransactionHistory } from '@hooks/useTransactionHistory'
import { useUsdAmount } from '@hooks/useUsdAmount'
import { networkIdAtom } from 'src/state/wallet/atoms'
import { useAtomValue } from 'jotai'
import { useETHPrice } from '@hooks/useETHPrice'
import { normFactorAtom } from 'src/state/controller/atoms'

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
  const { transactions } = useTransactionHistory()
  const networkId = useAtomValue(networkIdAtom)
  const ethPrice = useETHPrice()
  const normalizationFactor = useAtomValue(normFactorAtom)

  const classes = useStyles()
  const { getUsdAmt } = useUsdAmount()

  return (
    <div className={classes.container}>
      {transactions.map((tx, index) => (
        <div className={classes.historyItem} key={tx.timestamp + index}>
          <div className={classes.txItemCol}>
            <Typography variant="body2">{tx.transactionType}</Typography>
            <Typography variant="caption" color="textSecondary">
              {new Date(Number(tx.timestamp) * 1000).toDateString()}
            </Typography>
          </div>
          {tx.transactionType === TransactionType.CRAB_FLASH_DEPOSIT ||
          tx.transactionType === TransactionType.CRAB_FLASH_WITHDRAW ? (
            <>
              <div className={classes.txItemVal}>
                <Typography
                  variant="body2"
                  className={tx.transactionType === TransactionType.CRAB_FLASH_WITHDRAW ? classes.red : classes.green}
                >
                  {tx.ethAmount.toFixed(4)}&nbsp; WETH
                </Typography>
                <Typography variant="caption" color="textSecondary">
                  ${getUsdAmt(tx.ethAmount, tx.timestamp).toFixed(2)}
                </Typography>
              </div>
              <div className={classes.txItemVal} />
            </>
          ) : (
            <>
              <div className={classes.txItemVal}>
                <Typography
                  variant="body2"
                  className={
                    tx.transactionType === TransactionType.BUY ||
                    tx.transactionType === TransactionType.BURN_SHORT ||
                    tx.transactionType === TransactionType.REMOVE_LIQUIDITY
                      ? classes.green
                      : classes.red
                  }
                >
                  {tx.squeethAmount.toFixed(8)}&nbsp; oSQTH
                </Typography>
                <Typography variant="caption" color="textSecondary">
                  ${tx.squeethAmount.times(ethPrice).times(ethPrice).div(10000).times(normalizationFactor).toFixed(2)}
                </Typography>
              </div>
              <div className={classes.txItemVal}>
                <Typography
                  variant="body2"
                  className={
                    tx.transactionType === TransactionType.BUY ||
                    tx.transactionType === TransactionType.BURN_SHORT ||
                    tx.transactionType === TransactionType.ADD_LIQUIDITY
                      ? classes.red
                      : classes.green
                  }
                >
                  {tx.transactionType === TransactionType.CRAB_V2_USDC_FLASH_DEPOSIT ||
                  tx.transactionType === TransactionType.CRAB_V2_USDC_FLASH_WITHDRAW
                    ? `${tx.usdValue.toFixed(2)} USDC`
                    : `${tx.ethAmount.toFixed(4)} WETH`}
                </Typography>
                <Typography variant="caption" color="textSecondary">
                  {tx.transactionType === TransactionType.CRAB_V2_USDC_FLASH_DEPOSIT ||
                  tx.transactionType === TransactionType.CRAB_V2_USDC_FLASH_WITHDRAW
                    ? `${tx.ethAmount.toFixed(4)} WETH`
                    : `$${tx.usdValue.toFixed(2)}`}
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
