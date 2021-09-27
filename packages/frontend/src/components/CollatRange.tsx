import { createStyles, makeStyles, Tooltip } from '@material-ui/core'
import { yellow } from '@material-ui/core/colors'
import React from 'react'

const useStyles = makeStyles((theme) =>
  createStyles({
    container: {
      width: '300px',
      display: 'flex',
      height: '6px',
      marginLeft: 'auto',
      marginRight: 'auto',
    },
    danger: {
      width: '30%',
      backgroundColor: theme.palette.error.main,
      borderRadius: theme.spacing(1, 0, 0, 1),
    },
    warning: {
      width: '30%',
      backgroundColor: yellow[700],
    },
    safe: {
      width: '40%',
      backgroundColor: theme.palette.success.main,
      borderRadius: theme.spacing(0, 1, 1, 0),
    },
    thumb: {
      width: '4px',
      height: '10px',
      backgroundColor: theme.palette.text.primary,
      position: 'relative',
      left: '98%',
      top: '-40%',
      cursor: 'pointer',
    },
  }),
)

const CollatRange: React.FC = () => {
  const classes = useStyles()

  return (
    <div className={classes.container}>
      <div className={classes.danger}>
        <Tooltip
          title={
            <div>
              <p>200% collateral ratio</p>
              <p>33% spot move to liquidation</p>
            </div>
          }
        >
          <div className={classes.thumb}></div>
        </Tooltip>
      </div>
      <div className={classes.warning}>
        <Tooltip
          title={
            <div>
              <p>225% collateral ratio</p>
              <p>50% spot move to liquidation</p>
            </div>
          }
        >
          <div className={classes.thumb}></div>
        </Tooltip>
      </div>
      <div className={classes.safe}></div>
    </div>
  )
}

export default CollatRange
