import { PlainButton } from '@components/Button'
import { Box, Button, Divider, IconButton, Typography } from '@material-ui/core'
import { createStyles, makeStyles } from '@material-ui/core/styles'
import React from 'react'
import AddIcon from '@material-ui/icons/Add'
import RemoveIcon from '@material-ui/icons/Remove'
import { useState } from 'react'
import { priceToClosestTick, tickToPrice } from '@uniswap/v3-sdk'
import { Token } from '@uniswap/sdk-core'
import useAppEffect from '@hooks/useAppEffect'
import useAppCallback from '@hooks/useAppCallback'
import { useCallback } from 'react'
import { useEffect } from 'react'
import { calculateTickForPrice } from '@utils/lpUtils'

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
  tick: number
  onChange: (value: number) => void
  label: string
  hint: string
  minValue: number
  spacing: number
  baseToken: Token
  quoteToken: Token
  tickSpacing: number
  isWethToken0: boolean
  isMax?: boolean
}

export const LPPriceInput: React.FC<LPPriceInputType> = ({
  tick: initTick,
  onChange,
  label,
  hint,
  baseToken,
  quoteToken,
  tickSpacing,
  isWethToken0,
}) => {
  const classes = useStyles()
  const [input, setInput] = useState(0)
  const [tick, setTick] = useState(initTick)

  useAppEffect(() => {
    console.log('Tick inside LpPriceInput', tick)
    // During intermediate state baseToken and quoteToken will be in diff chain. This will throw error
    if (baseToken.chainId !== quoteToken.chainId) return

    const price = tickToPrice(baseToken, quoteToken, tick).toSignificant(5)
    setInput(parseFloat(price))
  }, [baseToken, quoteToken, tick])

  const handleInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const { value } = e.target
      if (value === '') setInput(0)

      setInput(Number(value))
    },
    [setInput],
  )

  const decreaseValue = () => {
    setTick(isWethToken0 ? tick + tickSpacing : tick - tickSpacing)
  }

  const increaseValue = () => {
    setTick(isWethToken0 ? tick - tickSpacing : tick + tickSpacing)
  }

  const calculateTick = () => {
    const _newTick = calculateTickForPrice(input, quoteToken, baseToken, tickSpacing)
    const price = tickToPrice(baseToken, quoteToken, tick).toSignificant(5)

    setInput(parseFloat(price))
    if (_newTick && tick !== _newTick) setTick(_newTick)
  }

  useAppEffect(() => {
    onChange(tick)
  }, [onChange, tick])

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
        <IconButton className={classes.iconButton} onClick={decreaseValue} onBlur={calculateTick}>
          <RemoveIcon />
        </IconButton>
        <input
          className={classes.input}
          style={{ maxWidth: '100px', textAlign: 'center', margin: '0px' }}
          value={input}
          onChange={handleInput}
          placeholder="0.0000"
          type="number"
          onBlur={calculateTick}
          onKeyDown={(e) => {
            if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
              e.preventDefault()
              e.key === 'ArrowUp' ? increaseValue() : decreaseValue()
            }
          }}
        />
        <IconButton className={classes.iconButton} onClick={increaseValue} onBlur={calculateTick}>
          <AddIcon />
        </IconButton>
      </Box>
    </Box>
  )
}
