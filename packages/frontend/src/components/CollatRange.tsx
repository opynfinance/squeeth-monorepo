import { createStyles, makeStyles, Tooltip } from '@material-ui/core'
import { yellow } from '@material-ui/core/colors'
import React, { useMemo, useState } from 'react'

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
  }),
)

type CollatRangeType = {
  collatValue: number
  onCollatValueChange: (val: number) => void
}

const CollatRange: React.FC<CollatRangeType> = ({ collatValue, onCollatValueChange }) => {
  const classes = useStyles()
  const minCollatRatio = 150

  const changeSlider = (val: number[]) => {
    if (val[1] < minCollatRatio) return

    onCollatValueChange(val[1])
  }

  const sliderClass = useMemo(() => {
    if (collatValue < 200) return classes.danger
    if (collatValue < 225) return classes.warning
    return classes.safe
  }, [classes.danger, classes.warning, classes.safe, collatValue])

  const marks = useMemo(() => {
    return [
      {
        value: 0,
        label: (
          <Tooltip title="Collateralization ratio">
            <span>0%</span>
          </Tooltip>
        ),
      },
      {
        value: minCollatRatio,
        label: (
          <Tooltip title="Minimum collateralization ratio">
            <span>{minCollatRatio}%</span>
          </Tooltip>
        ),
      },
      { value: 100, label: '100%' },
    ]
  }, [])

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

  return (
    <div className={classes.container}>
      <Slider
        value={[minCollatRatio, collatValue]}
        ThumbComponent={ThumbComponent}
        onChange={(_, val) => changeSlider(val as number[])}
        step={0.1}
        style={{ width: '95%' }}
        classes={{ thumb: sliderClass, track: sliderClass }}
        // marks={marks}
        min={150}
        max={300}
      />
    </div>
  )
}

export default CollatRange
