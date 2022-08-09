import { useCrabStrategyV2TxHistory } from '@hooks/useCrabV2AuctionHistory'
import { IconButton, Typography } from '@material-ui/core'
import { createStyles, makeStyles } from '@material-ui/core/styles'
import React, { useState } from 'react'
import { EtherscanPrefix } from '../../../constants'
import OpenInNewIcon from '@material-ui/icons/OpenInNew'
import Menu from '@material-ui/core/Menu'
import MenuItem from '@material-ui/core/MenuItem'
import KeyboardArrowDownOutlinedIcon from '@material-ui/icons/KeyboardArrowDownOutlined'
import { GreyButton } from '@components/Button'
import { useUserCrabV2TxHistory } from '@hooks/useUserCrabV2TxHistory'
import { CrabStrategyV2TxType, Networks } from '../../../types/index'
import clsx from 'clsx'
import { useAtomValue } from 'jotai'
import { addressAtom, networkIdAtom } from 'src/state/wallet/atoms'

const useStyles = makeStyles((theme) =>
  createStyles({
    container: {
      marginTop: theme.spacing(10),
      marginBottom: theme.spacing(10),
    },
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
      display: 'flex',
      alignItems: 'center',
      width: '30%',
    },
    txLink: {
      display: 'flex',
      alignItems: 'center',
      width: '3%',
    },
    green: {
      color: theme.palette.success.main,
    },
    red: {
      color: theme.palette.error.main,
    },
  }),
)

enum TxType {
  HEDGES = 'Hedges',
  MY_TX = 'My Transactions',
}

export const CrabStrategyV2History: React.FC = () => {
  const classes = useStyles()
  const { data } = useCrabStrategyV2TxHistory()

  const address = useAtomValue(addressAtom)
  const networkId = useAtomValue(networkIdAtom)

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
      {txType === TxType.HEDGES ? (
        <div>
          {data?.map((d) => {
            return (
              <div className={classes.txItem} key={d.id}>
                <div className={classes.txSubItemTitle}>
                  <Typography variant="subtitle1">Hedge</Typography>
                  <Typography variant="caption" color="textSecondary">
                    {new Date(d.timestamp * 1000).toLocaleString(undefined, {
                      day: 'numeric',
                      month: 'short',
                      hour: 'numeric',
                      minute: 'numeric',
                    })}
                  </Typography>
                </div>
                <div className={clsx(classes.txSubItem, d.isBuying ? classes.green : classes.red)}>
                  <Typography variant="subtitle1">
                    <b style={{ fontWeight: 600 }}>{d.oSqueethAmount.toFixed(6)}</b> oSQTH
                  </Typography>
                </div>
                <div className={clsx(classes.txSubItem, d.isBuying ? classes.red : classes.green)}>
                  <Typography variant="subtitle1">
                    <b style={{ fontWeight: 600 }}>{d.ethAmount.toFixed(6)}</b> ETH
                  </Typography>
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
      ) : null}
    </div>
  )
}

const UserCrabHistory: React.FC<{ user: string; networkId: Networks }> = ({ user, networkId }) => {
  const classes = useStyles()
  const { data } = useUserCrabV2TxHistory(user, true)

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
              <Typography
                variant="subtitle1"
                className={
                  d.type === CrabStrategyV2TxType.FLASH_DEPOSIT || d.type === CrabStrategyV2TxType.DEPOSIT_V1
                    ? classes.red
                    : classes.green
                }
              >
                <b style={{ fontWeight: 600 }}>{d.ethAmount.toFixed(6)}</b> ETH
              </Typography>
              <Typography variant="caption" color="textSecondary">
                ${d.ethUsdValue.toFixed(2)}
              </Typography>
            </div>
            <div className={classes.txSubItem} />
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

export default CrabStrategyV2History
