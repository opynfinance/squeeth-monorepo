import { Typography } from '@material-ui/core'
import { createStyles, makeStyles } from '@material-ui/core/styles'
import clsx from 'clsx'
import React from 'react'

import { LinkButton } from '../Button'

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
  value: string
  min?: string
  max?: string
  onChange: (value: string) => void
  step?: number
  hint?: string | React.ReactNode // Used for error as well
  id?: string
  error?: boolean
  actionTxt?: string
  onActionClicked?: () => void
}

const DecimalRegex = RegExp('^[-]?[0-9]*[.]{1}[0-9]*$')

/**
 * Input to handle BigNumber with spinner buttons.
 */
const NumberInput: React.FC<NumberInputType> = ({
  value = '',
  min,
  max,
  onChange,
  step,
  placeholder,
  unit,
  hint,
  id,
  error,
  actionTxt,
  onActionClicked,
}) => {
  const classes = useStyles()

  const onValueChange = (v: string) => {
    // To render '-' or emptyString as bigNumber('-').toString() always gives 0
    if (v === '' || v === '-' || v === '0') {
      return onChange(v)
    }

    if (min && Number(min) > Number(v)) {
      return onChange(min)
    } else if (max && Number(max) < Number(v)) {
      return onChange(max)
    }

    if (Number(v) !== 0) {
      //if it is integer, remove leading zeros
      if (!DecimalRegex.test(v)) {
        v = Number(v).toString()
      }
    } else {
      // remain input box w single zero, but keep zero when have decimal
      v = v.replace(/^[0]+/g, '0')
    }
    return onChange(v)
  }

  const increment = (step: number) => {
    const val = parseFloat(value.toString() || '0')
    onValueChange((val + step).toFixed(1))
  }

  return (
    <div>
      <div className={!error ? classes.container : clsx(classes.container, classes.error)}>
        <div className={classes.inputContainer}>
          <input
            id={id}
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
        {actionTxt && onActionClicked ? (
          <LinkButton
            size="small"
            color="primary"
            onClick={onActionClicked}
            variant="text"
            style={{ marginLeft: '250px' }}
          >
            {actionTxt}
          </LinkButton>
        ) : null}
      </div>
    </div>
  )
}

export default NumberInput
