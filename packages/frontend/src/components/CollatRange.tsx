import { createStyles, makeStyles, Tooltip, Collapse } from '@material-ui/core'
import { yellow } from '@material-ui/core/colors'
import Circle from '@material-ui/icons/FiberManualRecord'
import Alert from '@material-ui/lab/Alert'
import React from 'react'

import Slider from './CustomSlider'

const useStyles = makeStyles((theme) =>
  createStyles({
    container: {
      width: '300px',
      marginLeft: 'auto',
      marginRight: 'auto',
    },
    danger: {
      backgroundColor: theme.palette.error.main,
    },
    warning: {
      backgroundColor: yellow[700],
    },
    safe: {
      backgroundColor: theme.palette.success.main,
    },
    legendsContainer: {
      display: 'flex',
      fontSize: '0.75rem',
      marginBottom: '.5em',
    },
    legend: {
      display: 'flex',
      alignItems: 'center',
      marginRight: '1em',
    },
    legendIcon: {
      fontSize: '0.75rem',
      marginRight: '5px',
    },
  }),
)

type CollatRangeType = {
  id?: string
  collatValue: number
  onCollatValueChange: (val: number) => void
  className?: string
}

const CollatRange: React.FC<CollatRangeType> = ({ id, collatValue, onCollatValueChange, className }) => {
  const classes = useStyles()

  const minCollatRatio = 150

  const changeSlider = (val: number[]) => {
    if (val[1] < minCollatRatio) return

    onCollatValueChange(val[1])
  }

  // eslint-disable-next-line react/display-name
  const ThumbComponent = React.useCallback((props: any) => {
    if (props['data-index'] === 0) {
      props.style.backgroundColor = 'grey'
      props.style.height = 10
      props.style.marginTop = '-2px'

      return (
        <Tooltip title="Minimum collateralization ratio">
          <span {...props}></span>
        </Tooltip>
      )
    }

    return <span {...props}></span>
  }, [])

  const sliderClass = collatValue < 200 ? classes.danger : collatValue < 225 ? classes.warning : classes.safe

  return (
    <div className={classes.container} id={id}>
      {collatValue === 150 && <div style={{ color: 'red' }}></div>}
      <Slider
        value={[minCollatRatio, collatValue]}
        ThumbComponent={ThumbComponent}
        onChange={(_, val) => changeSlider(val as number[])}
        step={0.1}
        style={{ width: '100%' }}
        classes={{
          thumb: sliderClass,
          track: sliderClass,
        }}
        className={className}
        min={150}
        max={600}
        id={id + '-slider'}
      />
      <div className={classes.legendsContainer}>
        <span className={classes.legend}>
          <Circle className={classes.legendIcon} style={{ color: '#f5475c' }} />
          <span>DANGER</span>
        </span>
        <span className={classes.legend}>
          <Circle className={classes.legendIcon} style={{ color: '#fbc02d' }} />
          <span>RISKY</span>
        </span>
        <span className={classes.legend}>
          <Circle className={classes.legendIcon} style={{ color: '#49D273' }} />
          <span>SAFE</span>
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
        <Collapse in={collatValue === 150}>
          <Alert severity="error" id={id + '-alert-text'}>
            You will get liquidated
          </Alert>
        </Collapse>
        <Collapse in={collatValue !== 150 && collatValue < 175}>
          <Alert severity="warning" id={id + '-alert-text'}>
            Collateral ratio is risky. You will get liquidated at 150%.
          </Alert>
        </Collapse>
      </div>
    </div>
  )
}

export default CollatRange
