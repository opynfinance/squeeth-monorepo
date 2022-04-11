import { Box, Button, Divider, useTheme, withStyles } from '@material-ui/core'
import Typography from '@material-ui/core/Typography'
import { createStyles, makeStyles } from '@material-ui/core/styles'
import React from 'react'
import { PrimaryButton } from '@components/Button/index'
import LPBuyChart from '@components/Charts/LPBuyChart'
import LPMintChart from '@components/Charts/LPMintChart'
import { useState } from 'react'
import { useETHPrice } from '@hooks/useETHPrice'
import { useAtom } from 'jotai'
import { seeLPIntroAtom } from 'pages/lp'

const useStyles = makeStyles((theme) =>
  createStyles({
    container: {
      backgroundColor: theme.palette.background.lightStone,
      padding: theme.spacing(4),
      borderRadius: theme.spacing(2),
      maxHeight: '65vh',
      overflow: 'scroll',
    },
    body3: { ...theme.typography.body3 },
    chart: {
      backgroundColor: theme.palette.background.stone,
      borderRadius: theme.spacing(3),
    },
    nonActiveBtn: {
      color: theme.palette.text.disabled,
    },
  }),
)

export const SimpleButton = withStyles((theme) => ({
  root: {
    color: theme.palette.text.primary,
    fontWeight: 700,
    fontSize: '25px',
    backgroundColor: 'transparent',
    '&:hover': {
      backgroundColor: 'transparent',
    },
    padding: 0,
    textTransform: 'none',
  },
}))(Button)

enum LPType {
  BUY,
  MINT,
}

const LPIntroCard: React.FC = () => {
  const classes = useStyles()
  const ethPrice = useETHPrice()
  const [lpType, setLpType] = useState(LPType.BUY)
  const [, setSeeLPIntro] = useAtom(seeLPIntroAtom)

  return (
    <Box className={classes.container}>
      <Box display="flex" justifyContent="space-between" alignItems="center">
        <Box>
          <Typography variant="subtitle2">Choose your strategy</Typography>
          <Box mt={0.5}>
            <SimpleButton
              style={{ opacity: lpType === LPType.BUY ? '1' : '.3' }}
              size="small"
              onClick={() => setLpType(LPType.BUY)}
            >
              Buy & LP
            </SimpleButton>
            <SimpleButton
              style={{ marginLeft: '16px', opacity: lpType === LPType.MINT ? '1' : '.3' }}
              size="small"
              onClick={() => setLpType(LPType.MINT)}
            >
              Mint & LP
            </SimpleButton>
          </Box>
        </Box>
        <Box>
          <PrimaryButton style={{ minWidth: 120 }} onClick={() => setSeeLPIntro(false)}>
            Start Now
          </PrimaryButton>
        </Box>
      </Box>
      {lpType === LPType.BUY ? (
        <>
          <Box mt={2}>
            <Typography color="textSecondary" className={classes.body3}>
              Buying and LPing gives you a leverage position with a payoff similar to ETH1.5. You give up some of your
              squeeth upside in exchange for trading fees. You are paying funding for being long squeeth, but earning
              fees from LPing on Uniswap.
            </Typography>
          </Box>
          <Box mt={2} className={classes.chart}>
            <Box p={1.5}>
              <Typography variant="caption">
                This payoff diagram does not include funding or trading fees, and assumes implied volatility stays
                constant.
              </Typography>
            </Box>
            <Divider />
            <LPBuyChart ethPrice={ethPrice.toNumber()} />
          </Box>
        </>
      ) : (
        <>
          <Box mt={2}>
            <Typography color="textSecondary" className={classes.body3}>
              Minting and LPing is similar to a covered call. You start off with a position similar to 1x long ETH that
              gets less long ETH as the price moves up and longer ETH as the price moves down.
            </Typography>
          </Box>
          <Box mt={2} className={classes.chart}>
            <Box p={1.5}>
              <Typography variant="caption">
                This payoff diagram does not include funding or trading fees, and assumes implied volatility stays
                constant.
              </Typography>
            </Box>
            <Divider />
            <LPMintChart ethPrice={ethPrice.toNumber()} />
          </Box>
        </>
      )}
    </Box>
  )
}

export default LPIntroCard
