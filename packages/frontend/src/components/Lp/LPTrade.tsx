import { PrimaryButton } from '@components/Button'
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
import { addressesAtom } from 'src/state/positions/atoms'
import { useBuyAndLP } from 'src/state/squeethPool/hooks'
import { addressAtom } from 'src/state/wallet/atoms'
import { SimpleButton } from './LPIntroCard'
import { useWalletBalance } from 'src/state/wallet/hooks'
import useAppMemo from '@hooks/useAppMemo'
import { toTokenAmount } from '@utils/calculations'
import BigNumber from 'bignumber.js'
import useAppCallback from '@hooks/useAppCallback'

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
  const [, setSeeLPIntro] = useAtom(seeLPIntroAtom)
  const buyAndLP = useBuyAndLP()

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
        <PrimaryButton style={{ minWidth: 120 }} onClick={() => buyAndLP()}>
          Continue
        </PrimaryButton>
      </Box>
      <Divider />
      <BuyAndLP />
    </div>
  )
}

const BuyAndLP = memo(function BuyAndLP() {
  const classes = useStyles()
  const { oSqueeth } = useAtomValue(addressesAtom)
  const { value: oSqueethBal } = useTokenBalance(oSqueeth, 15, OSQUEETH_DECIMALS)
  const { data: bal } = useWalletBalance()

  const [sqthAmount, setSqthAmount] = useState('')
  const [ethAmount, setEthAmount] = useState('')
  const [minPrice, setMinPrice] = useState(0)
  const [maxPrice, setMaxPrice] = useState(0)

  const ethBalance = useAppMemo(() => {
    if (!bal) return new BigNumber(0)

    return toTokenAmount(bal, WETH_DECIMALS)
  }, [bal])

  const updateSqthAmount = useAppCallback(
    (v: string) => {
      setSqthAmount(v)
    },
    [setSqthAmount],
  )

  const updateEthAmount = useAppCallback(
    (v: string) => {
      setEthAmount(v)
    },
    [setEthAmount],
  )

  return (
    <Box px={3} mt={3}>
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
            value={minPrice}
            onChange={(v) => setMinPrice(v)}
            label="Min price"
            hint="ETH per oSQTH"
            minValue={0}
            spacing={0.001}
          />
        </Box>
        <Box className={classes.medianBox}></Box>
        <Box width="45%">
          <LPPriceInput
            value={maxPrice}
            onChange={(v) => setMinPrice(v)}
            label="Max price"
            hint="ETH per oSQTH"
            minValue={0}
            spacing={0.001}
          />
        </Box>
      </Box>
      <Box mt={2} display="flex" justifyContent="center">
        <Typography variant="body2" component="span" align="center" className={classes.currentPrice}>
          Current price: 0.2345
          <Typography component="span" variant="body2" color="textSecondary">
            {' '}
            ETH per OSQTH
          </Typography>
        </Typography>
      </Box>
    </Box>
  )
})

export default LPTrade
