import { Typography } from '@material-ui/core'
import { createStyles, makeStyles } from '@material-ui/core/styles'
import BigNumber from 'bignumber.js'
import clsx from 'clsx'
import React, { useEffect, useState } from 'react'

const useStyles = makeStyles((theme) =>
  createStyles({
    container: {
      padding: theme.spacing(1),
      border: `1px solid ${theme.palette.background.stone}`,
      borderRadius: theme.spacing(1),
      '&:focus-within': {
        border: `1px solid ${theme.palette.secondary.main}50`,
      },
    },
    input: {
      border: 'none',
      backgroundColor: 'inherit',
      outline: 'none',
      fontSize: '18px',
      color: theme.palette.text.primary,
      fontWeight: theme.typography.fontWeightBold,
      fontFamily: theme.typography.fontFamily,
      width: '100%',
    },
    inputContainer: {
      display: 'flex',
      alignItems: 'center',
    },
    spinner: {
      background: theme.palette.background.lightStone,
      display: 'flex',
      justifyContent: 'space-between',
      borderRadius: theme.spacing(1),
      marginRight: theme.spacing(1),
      fontWeight: 600,
      color: '#000',
      fontSize: '18px',
    },
    plusButton: {
      background: theme.palette.success.main,
      border: 'none',
      borderRadius: '100%',
      width: '18px',
      height: '18px',
      margin: 'auto',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
    },
    errorButton: {
      background: theme.palette.error.main,
      border: 'none',
      width: '18px',
      height: '18px',
      borderRadius: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: theme.spacing(0.5),
      cursor: 'pointer',
    },
    minus: {
      width: '7px',
      height: '2px',
      background: '#000',
    },
    hint: {
      marginLeft: theme.spacing(0.5),
    },
    error: {
      border: `1px solid ${theme.palette.error.main}50`,
    },
  }),
)

type NumberInputType = {
  placeholder: string
  unit: string
  value: BigNumber
  min?: BigNumber
  max?: BigNumber
  onChange: (value: BigNumber) => void
  step?: number
  hint?: string // Used for error as well
  error?: boolean
}

/**
 * Input to handle BigNumber with spinner buttons.
 */
const NumberInput: React.FC<NumberInputType> = ({
  value: _val,
  min,
  max,
  onChange,
  step,
  placeholder,
  unit,
  hint,
  error,
}) => {
  const classes = useStyles()
  const [value, setValue] = useState<string>('')

  const onValueChange = (val: string) => {
    // To render '-' or emptyString as bigNumber('-').toString() always gives 0
    if (val === '' || val === '-' || val === '0') {
      setValue(val)
      onChange(new BigNumber(val))
      return
    }
    if (min && min.isGreaterThan(val)) {
      onChange(min)
    } else if (max && max.isLessThan(val)) {
      onChange(max)
    } else {
      onChange(new BigNumber(val))
    }
  }

  useEffect(() => {
    // To render '-' or emptyString as bigNumber('-').toString() always gives 0
    if (!((value === '-' || value === '') && _val?.toString() === '0')) {
      setValue(_val?.toString() || '')
    }
  }, [_val.toString()])

  const increment = (step: number) => {
    const val = parseFloat(value.toString() || '0')
    onValueChange((val + step).toFixed(1))
  }

  return (
    <div>
      <div className={!error ? classes.container : clsx(classes.container, classes.error)}>
        <div className={classes.inputContainer}>
          <input
            className={classes.input}
            value={value}
            onChange={(event) => onValueChange(event.target.value)}
            placeholder={placeholder}
            type="number"
          />
          <div className={classes.spinner}>
            <div className={classes.plusButton} onClick={() => increment(step || 1)}>
              +
            </div>
            <div className={classes.errorButton} onClick={() => increment(-(step || 1))}>
              <div className={classes.minus}></div>
            </div>
          </div>
          <Typography color="textSecondary">{unit}</Typography>
        </div>
      </div>
      <div className={classes.hint}>
        <Typography color={error ? 'error' : 'textSecondary'} variant="caption">
          {hint}
        </Typography>
      </div>
    </div>
  )
}

export default NumberInput
