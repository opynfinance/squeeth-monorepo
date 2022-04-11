import { OutlinedPlainButton, PrimaryButton } from '@components/Button'
import LPInput, { LPPriceInput } from '@components/Input/LPInputs'
import { OSQUEETH_DECIMALS, WETH_DECIMALS } from '../../constants'
import { useTokenBalance } from '@hooks/contracts/useTokenBalance'
import { Box, Divider, Typography } from '@material-ui/core'
import { createStyles, makeStyles } from '@material-ui/core/styles'
import { useAtom, useAtomValue } from 'jotai'
import { seeLPIntroAtom } from 'pages/lp'
import React from 'react'
import { useState } from 'react'
import { memo } from 'react'
import { addressesAtom, isWethToken0Atom } from 'src/state/positions/atoms'
import { useBuyAndLP } from 'src/state/squeethPool/hooks'
import { SimpleButton } from './LPIntroCard'
import { useWalletBalance } from 'src/state/wallet/hooks'
import useAppMemo from '@hooks/useAppMemo'
import { toTokenAmount } from '@utils/calculations'
import BigNumber from 'bignumber.js'
import useAppCallback from '@hooks/useAppCallback'
import { poolAtom, squeethInitialPriceAtom, squeethTokenAtom, wethTokenAtom } from 'src/state/squeethPool/atoms'
import { Position, TickMath } from '@uniswap/v3-sdk'
import { useMemo } from 'react'
import useAppEffect from '@hooks/useAppEffect'
import { calculateLPAmounts } from '@utils/lpUtils'
import {
  lpEthAmountAtom,
  lpIsSqthConstant,
  lpSqthAmountAtom,
  lpSwapAndAddResultAtom,
  lpTickLower,
  lpTickUpper,
  lpTxTypeAtom,
  LP_TX_TYPE,
} from 'src/state/lp/atoms'
import { useCallback } from 'react'
import { useLPInputValidation } from 'src/state/lp/hooks'
import { useUpdateAtom } from 'jotai/utils'
import { SwapToRatioStatus } from '@uniswap/smart-order-router'
import LPTransaction from './transaction/LPTransaction'
import LoadingButton from '@components/Button/LoadingButton'

const useStyles = makeStyles((theme) =>
  createStyles({
    container: {
      backgroundColor: theme.palette.background.lightStone,
      padding: theme.spacing(3, 0),
      borderRadius: theme.spacing(2),
      maxHeight: '65vh',
      overflow: 'scroll',
    },
    headerMenu: {
      backgroundColor: theme.palette.background.stone,
      borderRadius: theme.spacing(1.5),
      padding: theme.spacing(1),
    },
    helpButton: {
      borderLeft: `1px solid ${theme.palette.divider}`,
    },
    lpInputTitle: {
      color: theme.palette.text.secondary,
      fontSize: '14px',
      fontWeight: 600,
      marginBottom: theme.spacing(1),
    },
    medianBox: {
      border: `1px dashed ${theme.palette.divider}`,
      width: '100%',
      flexShrink: 2000,
    },
    currentPrice: {
      marginTop: theme.spacing(2),
      fontWeight: 500,
    },
  }),
)

const LPTrade: React.FC = () => {
  const classes = useStyles()
  const { oSqueeth } = useAtomValue(addressesAtom)
  const { value: oSqueethBal } = useTokenBalance(oSqueeth, 15, OSQUEETH_DECIMALS)
  const getBuyAndLP = useBuyAndLP()
  const [sqthAmount, setSqthAmount] = useAtom(lpSqthAmountAtom)
  const ethAmount = useAtomValue(lpEthAmountAtom)
  const [, setSeeLPIntro] = useAtom(seeLPIntroAtom)
  const [txType, setTxType] = useAtom(lpTxTypeAtom)
  const squeethPool = useAtomValue(poolAtom)
  const tickLower = useAtomValue(lpTickLower)
  const tickUpper = useAtomValue(lpTickUpper)
  const isWethToken0 = useAtomValue(isWethToken0Atom)
  const setSwapToRatioResponse = useUpdateAtom(lpSwapAndAddResultAtom)

  const [isFetchingSwap, setIsFetchingSwap] = useState(false)

  const calculateTxType = useCallback(async () => {
    if (oSqueethBal.lt(sqthAmount)) {
      setIsFetchingSwap(true)
      const newPosition = new Position({
        pool: squeethPool!,
        liquidity: 1,
        tickLower: isWethToken0 ? tickUpper : tickLower,
        tickUpper: isWethToken0 ? tickLower : tickUpper,
      })
      const [token0Bal, token1Bal] = isWethToken0
        ? [new BigNumber(ethAmount), oSqueethBal]
        : [oSqueethBal, new BigNumber(ethAmount)]
      const response = await getBuyAndLP(newPosition, token0Bal, token1Bal)
      setIsFetchingSwap(false)
      if (response.status === SwapToRatioStatus.SUCCESS) {
        setSwapToRatioResponse(response)
        setTxType(LP_TX_TYPE.SWAP_AND_ADD_LIQUIDITY)
        setSqthAmount(oSqueethBal.toString())
      }
    } else setTxType(LP_TX_TYPE.ADD_LIQUIDITY)
  }, [
    ethAmount,
    getBuyAndLP,
    isWethToken0,
    oSqueethBal,
    setSqthAmount,
    setSwapToRatioResponse,
    setTxType,
    sqthAmount,
    squeethPool,
    tickLower,
    tickUpper,
  ])

  const { isValidInput } = useLPInputValidation()

  return (
    <div className={classes.container}>
      <Box display="flex" justifyContent="space-between" alignItems="center" px={3} mb={2}>
        <Box display="flex" alignItems="center">
          <Box display="flex" alignItems="center" className={classes.headerMenu} height="100%">
            <SimpleButton style={{ opacity: '1', fontSize: '20px' }} size="small">
              Buy
            </SimpleButton>
            <Typography variant="caption" color="textSecondary">
              or
            </Typography>
            <SimpleButton style={{ opacity: '.3', fontSize: '20px' }} size="small">
              Mint
            </SimpleButton>
            <div className={classes.helpButton}>
              <SimpleButton
                onClick={() => setSeeLPIntro(true)}
                style={{ opacity: '.3', fontSize: '20px' }}
                size="small"
              >
                Help
              </SimpleButton>
            </div>
          </Box>
          <SimpleButton style={{ opacity: '.3', fontSize: '20px' }} size="small">
            › LP
          </SimpleButton>
        </Box>
        <Box>
          {txType !== LP_TX_TYPE.NONE ? (
            <SimpleButton
              size="small"
              style={{ fontSize: '14px', opacity: '.8', minWidth: 120 }}
              onClick={() => setTxType(LP_TX_TYPE.NONE)}
            >
              Cancel
            </SimpleButton>
          ) : (
            <LoadingButton
              style={{ minWidth: 120 }}
              onClick={calculateTxType}
              disabled={!isValidInput}
              isLoading={isFetchingSwap}
            >
              Continue
            </LoadingButton>
          )}
        </Box>
      </Box>
      <Divider />
      {txType === LP_TX_TYPE.NONE ? <LPAmountsForm /> : null}
      {txType === LP_TX_TYPE.ADD_LIQUIDITY || txType === LP_TX_TYPE.SWAP_AND_ADD_LIQUIDITY ? <LPTransaction /> : null}
    </div>
  )
}

const LPAmountsForm = memo(function BuyAndLP() {
  const classes = useStyles()
  const { oSqueeth } = useAtomValue(addressesAtom)
  const { value: oSqueethBal } = useTokenBalance(oSqueeth, 15, OSQUEETH_DECIMALS)
  const { data: bal } = useWalletBalance()
  const currentSqueethPrice = useAtomValue(squeethInitialPriceAtom)
  const squeethPool = useAtomValue(poolAtom)
  const wethToken = useAtomValue(wethTokenAtom)
  const squeethToken = useAtomValue(squeethTokenAtom)
  const isWethToken0 = useAtomValue(isWethToken0Atom)

  const [sqthAmount, setSqthAmount] = useAtom(lpSqthAmountAtom)
  const [ethAmount, setEthAmount] = useAtom(lpEthAmountAtom)
  const [isSqthConstant, setIsSqthConstant] = useAtom(lpIsSqthConstant) // If set as true oSqth amount will remain constant and ETH should be calculated
  const [tickLower, setTickLower] = useAtom(lpTickLower)
  const [tickUpper, setTickUpper] = useAtom(lpTickUpper)

  // Initial price
  const [suggestedTickLower, suggestedTickUpper] = useMemo(() => {
    let tickLower = TickMath.MIN_TICK
    let tickUpper = TickMath.MIN_TICK
    if (!squeethPool) {
      return [tickLower, tickUpper]
    }

    const { tickCurrent, tickSpacing } = squeethPool

    tickLower = Math.round((tickCurrent - 10 * tickSpacing) / tickSpacing) * tickSpacing
    tickUpper = Math.round((tickCurrent + 10 * tickSpacing) / tickSpacing) * tickSpacing

    if (isWethToken0) return [tickUpper, tickLower]

    return [tickLower, tickUpper]
  }, [isWethToken0, squeethPool])

  useAppEffect(() => {
    setTickLower(suggestedTickLower)
    setTickUpper(suggestedTickUpper)
  }, [setTickLower, setTickUpper, suggestedTickLower, suggestedTickUpper])

  const ethBalance = useAppMemo(() => {
    if (!bal) return new BigNumber(0)

    return toTokenAmount(bal, WETH_DECIMALS)
  }, [bal])

  const updateSqthAmount = useAppCallback(
    (v: string) => {
      setSqthAmount(v)
      setIsSqthConstant(true)
      const [newEthAmt] = calculateLPAmounts(squeethPool!, tickLower, tickUpper, 0, Number(v), isWethToken0)
      setEthAmount(newEthAmt.toString())
    },
    [isWethToken0, setEthAmount, setIsSqthConstant, setSqthAmount, squeethPool, tickLower, tickUpper],
  )

  const updateEthAmount = useAppCallback(
    (v: string) => {
      setEthAmount(v)
      setIsSqthConstant(false)
      const [, newSqthAmt] = calculateLPAmounts(squeethPool!, tickLower, tickUpper, Number(v), 0, isWethToken0)
      setSqthAmount(newSqthAmt.toString())
    },
    [isWethToken0, setEthAmount, setIsSqthConstant, setSqthAmount, squeethPool, tickLower, tickUpper],
  )

  const calculateAmountsForTickChange = useAppCallback(() => {
    if (isSqthConstant) {
      const [newEthAmt] = calculateLPAmounts(squeethPool!, tickLower, tickUpper, 0, Number(sqthAmount), isWethToken0)
      setEthAmount(newEthAmt.toString())
    } else {
      const [, newSqthAmt] = calculateLPAmounts(squeethPool!, tickLower, tickUpper, Number(ethAmount), 0, isWethToken0)
      setSqthAmount(newSqthAmt.toString())
    }
  }, [
    ethAmount,
    isSqthConstant,
    isWethToken0,
    setEthAmount,
    setSqthAmount,
    sqthAmount,
    squeethPool,
    tickLower,
    tickUpper,
  ])

  const updateTickLower = useAppCallback(
    (v: number) => {
      console.log('Update tick called', v)
      setTickLower(v)
      calculateAmountsForTickChange()
    },
    [calculateAmountsForTickChange, setTickLower],
  )

  const updateTickUpper = useAppCallback(
    (v: number) => {
      setTickUpper(v)
      calculateAmountsForTickChange()
    },
    [calculateAmountsForTickChange, setTickUpper],
  )

  if (!squeethPool || !wethToken || !squeethToken) {
    return (
      <Box width="100%" minHeight="40vh" pt={10}>
        <Typography component="p" align="center" color="textSecondary">
          Loading...
        </Typography>
      </Box>
    )
  }

  return (
    <Box px={3} mt={3} minHeight="40vh">
      <Box display="flex" justifyContent="space-between" mb={5}>
        <Box width="45%">
          <Typography variant="body1" className={classes.lpInputTitle}>
            Amount to LP{' '}
            <Typography component="span" style={{ fontSize: '14px' }}>
              (oSQTH)
            </Typography>
          </Typography>
          <LPInput
            value={sqthAmount}
            maxValue={oSqueethBal.toString()}
            onChange={updateSqthAmount}
            label="oSQTH balance"
          />
        </Box>
        <Box width="45%">
          <Typography variant="body1" className={classes.lpInputTitle}>
            Amount to LP{' '}
            <Typography component="span" style={{ fontSize: '14px' }}>
              (ETH)
            </Typography>
          </Typography>
          <LPInput
            value={ethAmount}
            maxValue={ethBalance?.toString() || ''}
            onChange={updateEthAmount}
            label="ETH balance"
          />
        </Box>
      </Box>
      <Typography variant="body1" className={classes.lpInputTitle} component="span">
        Set Price Range{' '}
        <Typography component="span" style={{ fontSize: '14px' }}>
          (oSQTH per ETH)
        </Typography>
      </Typography>
      <Box display="flex" justifyContent="space-between" mt={1} alignItems="center">
        <Box width="45%">
          <LPPriceInput
            tick={tickLower}
            onChange={updateTickLower}
            label="Min price"
            hint="ETH per oSQTH"
            minValue={0}
            spacing={0.001}
            baseToken={squeethToken!}
            quoteToken={wethToken!}
            isWethToken0={isWethToken0}
            tickSpacing={squeethPool.tickSpacing}
          />
        </Box>
        <Box className={classes.medianBox}></Box>
        <Box width="45%">
          <LPPriceInput
            tick={tickUpper}
            onChange={updateTickUpper}
            label="Max price"
            hint="ETH per oSQTH"
            minValue={0}
            spacing={0.001}
            baseToken={squeethToken!}
            quoteToken={wethToken!}
            isWethToken0={isWethToken0}
            tickSpacing={squeethPool.tickSpacing}
          />
        </Box>
      </Box>
      <Box mt={2} display="flex" justifyContent="center" flexDirection="column" alignItems="center">
        <Typography variant="body2" component="span" align="center" className={classes.currentPrice}>
          Current price: {currentSqueethPrice.toFixed(6)}
          <Typography component="span" variant="body2" color="textSecondary">
            {' '}
            ETH per OSQTH
          </Typography>
        </Typography>
        {/* <OutlinedPlainButton style={{ width: '300px', marginTop: '16px' }}>Full range</OutlinedPlainButton> */}
      </Box>
    </Box>
  )
})

export default LPTrade
