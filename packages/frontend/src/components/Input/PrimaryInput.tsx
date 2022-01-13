import { CircularProgress, Tooltip, Typography } from '@material-ui/core'
import { createStyles, makeStyles } from '@material-ui/core/styles'
import InfoOutlinedIcon from '@material-ui/icons/InfoOutlined'
import clsx from 'clsx'
import React from 'react'

import { LinkButton } from '../Button'

const useStyles = makeStyles((theme) =>
  createStyles({
    container: {
      width: '300px',
      backgroundColor: 'inherit',
      textAlign: 'left',
      border: `1px solid ${theme.palette.background.stone}`,
      borderRadius: theme.spacing(1),
      padding: theme.spacing(1.5),
      margin: 'auto',
      marginBottom: '1em',
      '&:focus-within': {
        border: `1px solid ${theme.palette.secondary.main}30`,
      },
    },
    errorBorder: {
      border: `1px solid ${theme.palette.error.main}`,
      '&:focus-within': {
        border: `1px solid ${theme.palette.error.main}`,
      },
    },
    innerContainer: {
      display: 'flex',
      alignItems: 'flex-end',
      boxSizing: 'border-box',
      justifyContent: 'space-between',
    },
    rightContainer: {
      width: '50%',
    },
    unitsContainer: {},
    label: {
      color: theme.palette.text.secondary,
    },
    labelContainer: {
      display: 'flex',
      alignItems: 'center',
    },
    tooltipIcon: {
      color: theme.palette.text.hint,
      marginLeft: '6px',
      fontSize: '14px',
    },
    input: {
      border: 'none',
      backgroundColor: 'inherit',
      outline: 'none',
      fontSize: '22px',
      color: theme.palette.text.primary,
      fontWeight: theme.typography.fontWeightBold,
      fontFamily: theme.typography.fontFamily,
      width: '100%',
    },
    inputContainer: {
      margin: theme.spacing(0.5, 0),
    },
    unit: {
      fontSize: '22px',
    },
  }),
)

type PrimaryInputType = {
  value: number | string
  onChange: (value: string) => void
  label: string
  unit: string
  tooltip?: string
  actionTxt?: string
  onActionClicked?: () => void
  convertedValue: number | string
  hint?: string | React.ReactNode
  error?: boolean
  isLoading?: boolean
}

const DecimalRegex = RegExp('^[0-9]*[.]{1}[0-9]*$')

export const PrimaryInput: React.FC<PrimaryInputType> = ({
  value = '0',
  onChange,
  label,
  tooltip,
  actionTxt,
  onActionClicked,
  unit,
  convertedValue,
  hint,
  error = false,
  isLoading = false,
}) => {
  const classes = useStyles()

  return (
    <div className={clsx(classes.container, error && classes.errorBorder)}>
      <div className={classes.innerContainer}>
        <div className={classes.rightContainer}>
          <div className={classes.labelContainer}>
            <Typography variant="caption" className={classes.label}>
              {label}
            </Typography>
            {tooltip ? (
              <Tooltip title={tooltip}>
                <InfoOutlinedIcon fontSize="small" className={classes.tooltipIcon} />
              </Tooltip>
            ) : null}
          </div>
          <div className={classes.inputContainer}>
            <input
              className={classes.input}
              value={isNaN(Number(value)) ? 0 : value}
              onChange={(e) => {
                let v = e.target.value
                if (Number(v) < 0) return onChange('0')
                if (Number(v) !== 0) {
                  //if it is integer, remove leading zeros
                  if (!DecimalRegex.test(v)) {
                    v = Number(v).toString()
                  }
                } else {
                  // remain input box w single zero, but keep zero when have decimal
                  v = v.replace(/^[0]+/g, '0')
                  // if it is no value
                  if (v.length === 0) {
                    v = '0'
                  }
                }

                return onChange(v)
              }}
              onWheel={(e) => (e.target as any).blur()}
              placeholder="0"
              type="number"
              min="0"
            ></input>
          </div>
        </div>
        {/* <div>
          {actionTxt && onActionClicked ? (
            <Button size="small" color="primary" onClick={onActionClicked} variant="text">
              {actionTxt}
            </Button>
          ) : null}
        </div> */}
        <div className={classes.unitsContainer}>
          <Typography variant="caption">${convertedValue}</Typography>
          <Typography className={classes.unit}>{unit}</Typography>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <Typography variant="caption" color={error ? 'error' : 'textSecondary'}>
          {hint || ''}
        </Typography>
        {actionTxt && onActionClicked ? (
          <LinkButton size="small" color="primary" onClick={onActionClicked} variant="text">
            {actionTxt}
          </LinkButton>
        ) : null}
      </div>
      {isLoading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <Typography variant="caption" color={error ? 'error' : 'textSecondary'}>
            Fetching price data
          </Typography>
          <CircularProgress color="primary" size="1rem" />
        </div>
      ) : null}
    </div>
  )
}
