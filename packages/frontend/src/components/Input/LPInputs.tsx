import { PlainButton } from '@components/Button'
import { Box, Button, Divider, IconButton, Typography } from '@material-ui/core'
import { createStyles, makeStyles } from '@material-ui/core/styles'
import React from 'react'
import AddIcon from '@material-ui/icons/Add'
import RemoveIcon from '@material-ui/icons/Remove'

const useStyles = makeStyles((theme) =>
  createStyles({
    container: {
      background: theme.palette.background.stone,
      borderRadius: theme.spacing(1.5),
      minWidth: '200px',
    },
    input: {
      border: 'none',
      backgroundColor: 'inherit',
      outline: 'none',
      fontSize: '21px',
      color: theme.palette.text.primary,
      fontWeight: 700,
      fontFamily: theme.typography.fontFamily,
      width: '100%',
      marginRight: theme.spacing(3),
    },
    innerInputContainer: {
      padding: theme.spacing(1, 2),
    },
    balance: {
      fontWeight: 700,
    },
    iconButton: {
      background: theme.palette.background.stone,
      padding: 1,
    },
    priceInputContainer: {
      padding: theme.spacing(2, 2),
    },
  }),
)

type LPInputType = {
  value: string
  maxValue: string
  onChange: (value: string) => void
  label: string
}

const LPInput: React.FC<LPInputType> = ({ value, maxValue, onChange, label }) => {
  const classes = useStyles()

  return (
    <Box className={classes.container}>
      <Box display="flex" justifyContent="space-between" className={classes.innerInputContainer}>
        <input
          className={classes.input}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="0.0000"
          type="number"
        />
        <PlainButton onClick={() => onChange(maxValue)}>Max</PlainButton>
      </Box>
      <Divider />
      <Box display="flex" justifyContent="space-between" className={classes.innerInputContainer}>
        <Typography variant="body2" color="textSecondary">
          {label}
        </Typography>
        <Typography variant="body2" className={classes.balance}>
          {Number(maxValue).toFixed(6)}
        </Typography>
      </Box>
    </Box>
  )
}

export default LPInput

type LPPriceInputType = {
  value: number
  onChange: (value: number) => void
  label: string
  hint: string
  minValue: number
  spacing: number
  isMax?: boolean
}

export const LPPriceInput: React.FC<LPPriceInputType> = ({ value, onChange, label, hint, isMax }) => {
  const classes = useStyles()

  return (
    <Box className={classes.container}>
      <Box display="flex" justifyContent="space-between" className={classes.innerInputContainer}>
        <Typography variant="body2" className={classes.balance}>
          {label}
        </Typography>
        <Typography variant="body2" color="textSecondary">
          {hint}
        </Typography>
      </Box>
      <Divider />
      <Box
        display="flex"
        justifyContent="space-between"
        className={classes.priceInputContainer}
        marginTop={1}
        paddingBottom={2}
        alignItems="center"
      >
        <IconButton className={classes.iconButton}>
          <RemoveIcon />
        </IconButton>
        <input
          className={classes.input}
          style={{ maxWidth: '100px', textAlign: 'center', margin: '0px' }}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          placeholder="0.0000"
          type="number"
        />
        <IconButton className={classes.iconButton}>
          <AddIcon />
        </IconButton>
      </Box>
    </Box>
  )
}
