import { Button, createStyles, IconButton, makeStyles, Paper, Typography } from '@material-ui/core'
import Table from '@material-ui/core/Table'
import TableBody from '@material-ui/core/TableBody'
import TableCell from '@material-ui/core/TableCell'
import TableContainer from '@material-ui/core/TableContainer'
import TableHead from '@material-ui/core/TableHead'
import TableRow from '@material-ui/core/TableRow'
import OpenInNewIcon from '@material-ui/icons/OpenInNew'

import { EtherscanPrefix } from '../../constants'
import { TransactionType } from '../../constants/enums'
import { useWallet } from '../../context/wallet'
import { useTransactionHistory } from '../../hooks/useTransactionHistory'

const useStyles = makeStyles((theme) =>
  createStyles({
    container: {
      marginTop: theme.spacing(2),
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
  }),
)

const History: React.FC = () => {
  const { transactions } = useTransactionHistory()
  const { networkId } = useWallet()
  const classes = useStyles()

  return (
    <div>
      <Typography variant="body1" color="primary" align="center">
        Transaction history
      </Typography>
      <TableContainer className={classes.container}>
        <Table aria-label="simple table">
          <TableHead>
            <TableRow>
              <TableCell>
                <Typography variant="caption">Type</Typography>
              </TableCell>
              <TableCell align="right">
                <Typography variant="caption">Squeeth</Typography>
              </TableCell>
              <TableCell align="right">
                <Typography variant="caption">ETH Amount</Typography>
              </TableCell>
              <TableCell align="right">
                <Typography variant="caption">USD Value</Typography>
              </TableCell>
              <TableCell>
                <Typography variant="caption">Date</Typography>
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {transactions.map((row) => (
              <TableRow key={row.timestamp}>
                <TableCell>
                  <div className={classes.txTypeContainer}>
                    <Typography variant="caption">{row.transactionType}</Typography>
                    <IconButton size="small" href={`${EtherscanPrefix[networkId]}/${row.txId}`} target="_blank">
                      <OpenInNewIcon style={{ fontSize: '16px' }} color="secondary" />
                    </IconButton>
                  </div>
                </TableCell>
                <TableCell align="right">
                  <Typography
                    variant="caption"
                    className={
                      row.transactionType === TransactionType.BUY || row.transactionType === TransactionType.BURN_SHORT
                        ? classes.green
                        : classes.red
                    }
                  >
                    {row.squeethAmount.toFixed(6)}
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  <Typography
                    variant="caption"
                    className={
                      row.transactionType === TransactionType.BUY || row.transactionType === TransactionType.BURN_SHORT
                        ? classes.red
                        : classes.green
                    }
                  >
                    {row.ethAmount.toFixed(4)}
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  <Typography variant="caption">{row.usdValue.toFixed(4)}</Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="caption">{new Date(Number(row.timestamp) * 1000).toDateString()}</Typography>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </div>
  )
}

export default History
