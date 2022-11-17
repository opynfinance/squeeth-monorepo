import { createStyles, makeStyles, Tooltip } from '@material-ui/core'
import React, { useMemo, useCallback } from 'react'

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

const MAX_COLLATERAL_RATIO = 300

const MARK_VALUES = [
  HEALTH_CATEGORIES.DANGER.value,
  HEALTH_CATEGORIES.RISKY.value,
  HEALTH_CATEGORIES.SAFE.value,
  MAX_COLLATERAL_RATIO,
]

const getMarkValues = (minCollatRatio: number) => {
  // finds the index where minCollatRatio belongs
  const index = MARK_VALUES.findIndex((value) => value > minCollatRatio)

  // if "minCollatRatio" is the largest or smallest amongst all, original "markValues" is fine to continue with
  if (index === -1 || index === 0) {
    return MARK_VALUES
  } else {
    return [minCollatRatio, ...MARK_VALUES.slice(index)]
  }
}

const getMarks = (minCollatRatio: number) => {
  const markValues = getMarkValues(minCollatRatio)

  return markValues.map((markValue, index) => {
    const isFirstIndex = index === 0
    const isLastIndex = index === markValues.length - 1

    if (isFirstIndex) {
      return {
        value: markValue,
        label: `Min ${markValue}%`,
      }
    } else if (isLastIndex) {
      return {
        value: markValue,
        label: `Max ${markValue}%`,
      }
    } else {
      return {
        value: markValue,
        label: `${markValue}%`,
      }
    }
  })
}

const getHealthCategory = (value: number) => {
  if (value < HEALTH_CATEGORIES.DANGER.value) {
    return HEALTH_CATEGORIES.DANGER
  } else if (value >= HEALTH_CATEGORIES.DANGER.value && value < HEALTH_CATEGORIES.RISKY.value) {
    return HEALTH_CATEGORIES.DANGER
  } else if (value >= HEALTH_CATEGORIES.RISKY.value && value < HEALTH_CATEGORIES.SAFE.value) {
    return HEALTH_CATEGORIES.RISKY
  } else {
    return HEALTH_CATEGORIES.SAFE
  }
}

const getRailBackground: (minCollatRatio: number) => string = (minCollatRatio) => {
  const markValues = getMarkValues(minCollatRatio)
  const totalScale = markValues[markValues.length - 1] - markValues[0]

  const gradientObjs = markValues.reduce(
    (accGradientObjs, markValue, index) => {
      const isLastIndex = index === markValues.length - 1
      if (isLastIndex) {
        return accGradientObjs
      }

      const diffInMarkValues = markValues[index + 1] - markValue
      const diffInPercent = (diffInMarkValues * 100) / totalScale

      const lastPositionInPercent =
        accGradientObjs.length > 0 ? accGradientObjs[accGradientObjs.length - 1].position : 0
      const accumulatedPosition = diffInPercent + lastPositionInPercent

      const healthCategory = getHealthCategory(markValue)
      return [...accGradientObjs, { color: healthCategory.colors.LIGHT, position: accumulatedPosition }]
    },
    [] as Array<{
      color: string
      position: number
    }>,
  )

  const allGradients = gradientObjs.reduce((accGradients, current, index) => {
    const isFirstIndex = index === 0
    const isLastIndex = index === gradientObjs.length - 1

    const start = isFirstIndex ? current.color : `${current.color} ${gradientObjs[index - 1].position.toFixed(1)}%`
    const end = isLastIndex ? current.color : `${current.color} ${current.position.toFixed(1)}%`

    const gradients = `${accGradients}, ${start}, ${end}`
    return gradients.replace(/(^,)|(,$)/g, '') // trim leading and trailing commas
  }, '')

  return `linear-gradient(to right, ${allGradients})`
}

interface StylePropsType {
  railBackground: string
  lastMarkIndex: number
}

const useStyles = makeStyles((theme) =>
  createStyles({
    container: {
      width: '100%',
      marginLeft: 'auto',
      marginRight: 'auto',
    },
    danger: {
      backgroundColor: HEALTH_CATEGORIES.DANGER.colors.LIGHT,
    },
    warning: {
      backgroundColor: HEALTH_CATEGORIES.RISKY.colors.LIGHT,
    },
    safe: {
      backgroundColor: HEALTH_CATEGORIES.SAFE.colors.LIGHT,
    },

    rail: {
      opacity: 0.9,
      background: (props: StylePropsType): string => props.railBackground,
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
      '&[data-index="2"]': {
        transform: (props: StylePropsType): string => (props.lastMarkIndex === 2 ? 'translateX(-100%)' : ''),
      },
      '&[data-index="3"]': {
        transform: (props: StylePropsType): string => (props.lastMarkIndex === 3 ? 'translateX(-100%)' : ''),
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

  const marks = useMemo(() => getMarks(minCollatRatio), [minCollatRatio])
  const lastMarkIndex = marks.length - 1
  const railBackground = useMemo(() => getRailBackground(minCollatRatio), [minCollatRatio])

  const classes = useStyles({ railBackground, lastMarkIndex })

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
        marks={marks}
        min={minCollatRatio}
        max={MAX_COLLATERAL_RATIO}
        id={id + '-slider'}
      />
    </div>
  )
}

export default CollatRatioSlider
