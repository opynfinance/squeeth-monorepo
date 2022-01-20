import { useCrabStrategyTxHistory } from '@hooks/useCrabAuctionHistory'
import { IconButton, Typography } from '@material-ui/core'
import { createStyles, makeStyles } from '@material-ui/core/styles'
import { CrabStrategyTxType } from '../../../types/index'
import React from 'react'
import { EtherscanPrefix } from '../../../constants'
import OpenInNewIcon from '@material-ui/icons/OpenInNew'
import { useWallet } from '@context/wallet'

const useStyles = makeStyles((theme) =>
  createStyles({
    container: {},
    txItem: {
      background: theme.palette.background.stone,
      borderRadius: theme.spacing(1),
      padding: theme.spacing(1, 2),
      marginTop: theme.spacing(3),
      display: 'flex',
    },
    txSubItemTitle: {
      width: '37%',
    },
    txSubItem: {
      width: '30%',
    },
    txLink: {
      width: '3%',
    },
  }),
)

export const CrabStrategyHistory: React.FC = () => {
  const classes = useStyles()
  const { data, loading } = useCrabStrategyTxHistory()
  const { networkId } = useWallet()

  return (
    <div className={classes.container}>
      <Typography variant="h5" color="primary" style={{ marginTop: '32px' }}>
        Strategy History
      </Typography>
      <div>
        {loading}
        {data?.map((d) => {
          return (
            <div className={classes.txItem} key={d.id}>
              <div className={classes.txSubItemTitle}>
                <Typography variant="subtitle1">{d.isSellingSqueeth ? 'Sold' : 'Bought'}</Typography>
                <Typography variant="caption" color="textSecondary">
                  {new Date(d.timestamp * 1000).toLocaleString(undefined, {
                    day: 'numeric',
                    month: 'short',
                    hour: 'numeric',
                    minute: 'numeric',
                  })}
                </Typography>
              </div>
              <div className={classes.txSubItem}>
                <Typography variant="subtitle1">{d.oSqueethAmount.toFixed(6)} oSQTH</Typography>
              </div>
              <div className={classes.txSubItem}>
                <Typography variant="subtitle1">{d.ethAmount.toFixed(6)} ETH</Typography>
              </div>
              <div className={classes.txLink}>
                <IconButton size="small" href={`${EtherscanPrefix[networkId]}/${d.id}`} target="_blank">
                  <OpenInNewIcon style={{ fontSize: '16px' }} color="secondary" />
                </IconButton>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default CrabStrategyHistory
