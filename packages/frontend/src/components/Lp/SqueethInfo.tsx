import { Tooltip, Typography } from '@material-ui/core'
import { createStyles, makeStyles } from '@material-ui/core/styles'
import InfoIcon from '@material-ui/icons/InfoOutlined'
import React from 'react'

import { Tooltips } from '@constants/enums'
import { useController } from '@hooks/contracts/useController'
import { useSqueethPool } from '@hooks/contracts/useSqueethPool'
import { useETHPrice } from '@hooks/useETHPrice'
import { toTokenAmount } from '@utils/calculations'

const useStyles = makeStyles((theme) =>
  createStyles({
    squeethInfo: {
      [theme.breakpoints.down('sm')]: {
        width: '100%',
        marginTop: theme.spacing(2),
      },
      marginLeft: theme.spacing(10),
    },
    squeethInfoSubGroup: {
      display: 'flex',
      alignItems: 'center',
    },
    infoItem: {
      marginRight: theme.spacing(1),
      paddingRight: theme.spacing(1.5),
    },
    infoLabel: {
      display: 'flex',
      alignItems: 'center',
    },
    infoIcon: {
      fontSize: '14px',
      marginLeft: theme.spacing(0.5),
    },
  }),
)

const SqueethInfo: React.FC = () => {
  const classes = useStyles()
  const ethPrice = useETHPrice()
  const { mark, index, impliedVol } = useController()
  const { getWSqueethPositionValue, getWSqueethPositionValueInETH } = useSqueethPool()

  return (
    <div className={classes.squeethInfo}>
      <div>
        <div className={classes.squeethInfoSubGroup}>
          {/* hard coded width layout to align with the next line */}
          <div className={classes.infoItem}>
            <Typography color="textSecondary" variant="body2">
              ETH Price
            </Typography>
            <Typography>${Number(toTokenAmount(index, 18).sqrt()).toFixed(2).toLocaleString()}</Typography>
          </div>
          <div className={classes.infoItem}>
            <div className={classes.infoLabel}>
              <Typography color="textSecondary" variant="body2">
                ETH&sup2; Price
              </Typography>
            </div>
            <Typography>${Number(toTokenAmount(index, 18).toFixed(0)).toLocaleString()}</Typography>
          </div>
          <div className={classes.infoItem}>
            <div className={classes.infoLabel}>
              <Typography color="textSecondary" variant="body2">
                Mark Price
              </Typography>
              <Tooltip title={Tooltips.Mark}>
                <InfoIcon fontSize="small" className={classes.infoIcon} />
              </Tooltip>
            </div>
            <Typography>${Number(toTokenAmount(mark, 18).toFixed(0)).toLocaleString()}</Typography>
          </div>
          <div className={classes.infoItem}>
            <div className={classes.infoLabel}>
              <Typography color="textSecondary" variant="body2">
                oSQTH Price
              </Typography>
              <Tooltip title={Tooltips.oSQTHPrice}>
                <InfoIcon fontSize="small" className={classes.infoIcon} />
              </Tooltip>
            </div>
            <Typography>
              {getWSqueethPositionValue(1) && getWSqueethPositionValueInETH(1)
                ? '$' +
                  Number(getWSqueethPositionValue(1).toFixed(2).toLocaleString()) +
                  '\xa0 ' +
                  Number(getWSqueethPositionValueInETH(1).toFixed(4).toLocaleString()) +
                  ' ETH'
                : 'loading'}
            </Typography>
          </div>
          <div className={classes.infoItem}>
            <div className={classes.infoLabel}>
              <Typography color="textSecondary" variant="body2">
                Implied Volatility
              </Typography>
              <Tooltip title={Tooltips.ImplVol}>
                <InfoIcon fontSize="small" className={classes.infoIcon} />
              </Tooltip>
            </div>
            <Typography>{(impliedVol * 100).toFixed(2)}%</Typography>
          </div>

          {/* <div className={classes.infoItem}>
          <div className={classes.infoLabel}>
            <Typography color="textSecondary" variant="body2">
              Pool TVL
            </Typography>
          </div>
          <Typography>{tvl || 'loading'}%</Typography>
        </div> */}
        </div>
      </div>
    </div>
  )
}

export default SqueethInfo
