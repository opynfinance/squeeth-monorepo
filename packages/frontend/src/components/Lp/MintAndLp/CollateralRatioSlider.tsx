import { createStyles, makeStyles, Tooltip } from '@material-ui/core'
import React from 'react'

import Slider from '@components/CustomSlider'

const COLORS = {
  DANGER: {
    LIGHT: '#FA7B67',
    DARK: '#452C28',
  },
  RISKY: {
    LIGHT: '#F3FF6C',
    DARK: '#61662b',
  },
  SAFE: {
    LIGHT: '#67FABF',
    DARK: '#284539',
  },
}

const MIN_COLLATERAL_RATIO = 150
const MAX_COLLATERAL_RATIO = 300

const useStyles = makeStyles((theme) =>
  createStyles({
    container: {
      width: '100%%',
      marginLeft: 'auto',
      marginRight: 'auto',
    },
    danger: {
      backgroundColor: COLORS.DANGER.LIGHT,
    },
    warning: {
      backgroundColor: COLORS.RISKY.LIGHT,
    },
    safe: {
      backgroundColor: COLORS.SAFE.LIGHT,
    },
    rail: {
      background: `linear-gradient(to right, ${COLORS.DANGER.LIGHT}, ${COLORS.DANGER.LIGHT} 33.4%, ${COLORS.RISKY.LIGHT} 33.4%, ${COLORS.RISKY.LIGHT} 50%, ${COLORS.SAFE.LIGHT} 50%, ${COLORS.SAFE.LIGHT})`,
      opacity: 0.9,
    },
    track: {
      background: 'transparent',
    },
    mark: {
      background: theme.palette.background.lightStone,
    },
    markLabel: {
      marginTop: '6px',
      '&[data-index="0"]': {
        transform: 'none',
      },
      '&[data-index="3"]': {
        transform: 'translateX(-100%)',
      },
    },
    thumb: {
      visibility: 'hidden',
      '&:focus, &:hover, &.Mui-active': {
        visibility: 'hidden',
      },
    },
  }),
)

type CollateralRatioSliderType = {
  id?: string
  collateralRatio: number
  onCollateralRatioChange: (val: number) => void
  className?: string
}

const MARKS = [
  {
    value: 150,
    label: 'Min 150%',
  },
  {
    value: 200,
    label: '200%',
  },
  {
    value: 225,
    label: '225%',
  },
  {
    value: 300,
    label: 'Max 300%',
  },
]

const useValueLabelStyles = makeStyles(() =>
  createStyles({
    tooltip: (value: any) => ({
      backgroundColor: value < 200 ? COLORS.DANGER.DARK : value < 225 ? COLORS.RISKY.DARK : COLORS.SAFE.DARK,
      color: value < 200 ? COLORS.DANGER.LIGHT : value < 225 ? COLORS.RISKY.LIGHT : COLORS.SAFE.LIGHT,
      padding: '4px 8px',
      fontSize: '12px',
      fontWeight: 500,
    }),
  }),
)

function ValueLabelComponent(props: any) {
  const { children, open, value } = props

  const classes = useValueLabelStyles(value)
  const title = value < 200 ? 'Danger' : value < 225 ? 'Risky' : 'Safe'

  return (
    <Tooltip
      open={open}
      enterTouchDelay={0}
      placement="right-end"
      title={title}
      classes={classes}
      PopperProps={{
        modifiers: {
          offset: {
            offset: '4,-37',
          },
        },
      }}
    >
      {children}
    </Tooltip>
  )
}

const CollateralRatioSlider: React.FC<CollateralRatioSliderType> = ({
  id,
  collateralRatio,
  onCollateralRatioChange,
  className,
}) => {
  const classes = useStyles()

  const changeSlider = (val: number) => {
    if (val < MIN_COLLATERAL_RATIO) return
    onCollateralRatioChange(val)
  }

  return (
    <div className={classes.container} id={id}>
      <Slider
        value={collateralRatio}
        ValueLabelComponent={ValueLabelComponent}
        valueLabelDisplay="on"
        onChange={(_, val) => changeSlider(val as number)}
        step={1}
        classes={{
          rail: classes.rail,
          track: classes.track,
          mark: classes.mark,
          markLabel: classes.markLabel,
          thumb: classes.thumb,
        }}
        className={className}
        marks={MARKS}
        min={MIN_COLLATERAL_RATIO}
        max={MAX_COLLATERAL_RATIO}
        id={id + '-slider'}
      />
    </div>
  )
}

export default CollateralRatioSlider
