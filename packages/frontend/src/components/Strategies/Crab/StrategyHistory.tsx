import { useCrabStrategyTxHistory } from '@hooks/useCrabAuctionHistory'
import { IconButton, Typography } from '@material-ui/core'
import { createStyles, makeStyles } from '@material-ui/core/styles'
import React, { useState } from 'react'
import { EtherscanPrefix } from '../../../constants'
import OpenInNewIcon from '@material-ui/icons/OpenInNew'
import { useWallet } from '@context/wallet'
import Menu from '@material-ui/core/Menu'
import MenuItem from '@material-ui/core/MenuItem'
import KeyboardArrowDownOutlinedIcon from '@material-ui/icons/KeyboardArrowDownOutlined'
import { GreyButton } from '@components/Button'
import { useUserCrabTxHistory } from '@hooks/useUserCrabTxHistory'
import { Networks } from '../../../types/index'

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

enum TxType {
  HEDGES = 'Hedges',
  MY_TX = 'My Transactions',
}

export const CrabStrategyHistory: React.FC = () => {
  const classes = useStyles()
  const { data, loading } = useCrabStrategyTxHistory()
  const { networkId, address } = useWallet()

  const [txType, setTxType] = useState(TxType.HEDGES)
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget)
  }

  const handleClose = () => {
    setAnchorEl(null)
  }

  const handleItemClick = (type: TxType) => {
    setTxType(type)
    setAnchorEl(null)
  }

  return (
    <div className={classes.container}>
      <div style={{ display: 'flex', marginTop: '32px' }}>
        <Typography variant="h5" color="primary" style={{}}>
          Strategy History
        </Typography>
        <GreyButton
          aria-controls="simple-menu"
          aria-haspopup="true"
          style={{ marginLeft: '16px', width: '200px' }}
          onClick={handleClick}
          endIcon={<KeyboardArrowDownOutlinedIcon color="primary" />}
        >
          {txType}
        </GreyButton>
        <Menu id="simple-menu" anchorEl={anchorEl} keepMounted open={Boolean(anchorEl)} onClose={handleClose}>
          <MenuItem onClick={() => handleItemClick(TxType.HEDGES)}>Hedges</MenuItem>
          {!!address ? <MenuItem onClick={() => handleItemClick(TxType.MY_TX)}>My Transactions</MenuItem> : null}
        </Menu>
      </div>
      {!!address && txType === TxType.MY_TX ? <UserCrabHistory user={address} networkId={networkId} /> : null}
      <div>
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

const UserCrabHistory: React.FC<{ user: string; networkId: Networks }> = ({ user, networkId }) => {
  const classes = useStyles()
  const { data } = useUserCrabTxHistory(user)

  return (
    <>
      {data?.map((d) => {
        return (
          <div className={classes.txItem} key={d.id}>
            <div className={classes.txSubItemTitle}>
              <Typography variant="subtitle1">{d.txTitle}</Typography>
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
              <Typography variant="subtitle1">{d.ethAmount.toFixed(6)} ETH</Typography>
              <Typography variant="caption" color="textSecondary">
                ${d.ethUsdValue.toFixed(2)}
              </Typography>
            </div>
            <div className={classes.txSubItem}>
              <Typography variant="subtitle1">{d.oSqueethAmount.toFixed(6)} oSQTH</Typography>
            </div>
            <div className={classes.txLink}>
              <IconButton size="small" href={`${EtherscanPrefix[networkId]}/${d.id}`} target="_blank">
                <OpenInNewIcon style={{ fontSize: '16px' }} color="secondary" />
              </IconButton>
            </div>
          </div>
        )
      })}
    </>
  )
}

export default CrabStrategyHistory
