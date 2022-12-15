import { createStyles, makeStyles, Tooltip } from '@material-ui/core'
import React, { useCallback } from 'react'

import Slider from '@components/CustomSlider'

const HEALTH_CATEGORIES = {
  DANGER: {
    label: 'DANGER',
    value: 150,
    colors: {
      LIGHT: '#FA7B67',
      DARK: '#452C28',
    },
  },
  RISKY: {
    label: 'RISKY',
    value: 200,
    colors: {
      LIGHT: '#F3FF6C',
      DARK: '#61662b',
    },
  },
  SAFE: {
    label: 'SAFE',
    value: 225,
    colors: {
      LIGHT: '#67FABF',
      DARK: '#284539',
    },
  },
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

const useStyles = makeStyles((theme) =>
  createStyles({
    container: {
      width: '100%',
      marginLeft: 'auto',
      marginRight: 'auto',
    },
    rail: {
      opacity: 0.9,
      background: `linear-gradient(to right, ${HEALTH_CATEGORIES.DANGER.colors.LIGHT}, ${HEALTH_CATEGORIES.DANGER.colors.LIGHT} 33.4%, ${HEALTH_CATEGORIES.RISKY.colors.LIGHT} 33.4%, ${HEALTH_CATEGORIES.RISKY.colors.LIGHT} 50%,  ${HEALTH_CATEGORIES.SAFE.colors.LIGHT} 50%, ${HEALTH_CATEGORIES.SAFE.colors.LIGHT}  )`,
    },
    track: {
      background: 'transparent',
    },
    mark: {
      background: theme.palette.background.lightStone,
    },
    markLabel: {
      fontFamily: 'DM Mono',
      color: '#fff !important',
      marginTop: '6px',
      '&[data-index="0"]': {
        transform: 'none',
        marginLeft: '0 !important',
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

interface ValueLabelStylePropsType {
  value: number
}

const useValueLabelStyles = makeStyles(() =>
  createStyles({
    popper: {
      zIndex: 1000,
    },
    tooltip: {
      padding: '4px 8px',
      fontSize: '12px',
      fontWeight: 500,
      backgroundColor: (props: ValueLabelStylePropsType): string =>
        props.value < HEALTH_CATEGORIES.RISKY.value
          ? HEALTH_CATEGORIES.DANGER.colors.DARK
          : props.value < HEALTH_CATEGORIES.SAFE.value
          ? HEALTH_CATEGORIES.RISKY.colors.DARK
          : HEALTH_CATEGORIES.SAFE.colors.DARK,
      color: (props: ValueLabelStylePropsType): string =>
        props.value < HEALTH_CATEGORIES.RISKY.value
          ? HEALTH_CATEGORIES.DANGER.colors.LIGHT
          : props.value < HEALTH_CATEGORIES.SAFE.value
          ? HEALTH_CATEGORIES.RISKY.colors.LIGHT
          : HEALTH_CATEGORIES.SAFE.colors.LIGHT,
    },
  }),
)

function ValueLabelComponent(props: any) {
  const { children, open, value } = props

  const classes = useValueLabelStyles({ value })
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

interface CollatRatioSliderPropsType {
  id?: string
  collatRatio: number
  onCollatRatioChange: (val: number) => void
  minCollatRatio: number
  className?: string
}

const CollatRatioSlider: React.FC<CollatRatioSliderPropsType> = ({
  id,
  collatRatio,
  onCollatRatioChange,
  minCollatRatio,
  className,
}) => {
  const changeSlider = useCallback(
    (val: number) => {
      if (val < minCollatRatio) {
        return
      }
      onCollatRatioChange(val)
    },
    [minCollatRatio, onCollatRatioChange],
  )

  const classes = useStyles()

  return (
    <div className={classes.container} id={id}>
      <Slider
        value={collatRatio}
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
        min={150}
        max={300}
        id={id + '-slider'}
      />
    </div>
  )
}

export default CollatRatioSlider
