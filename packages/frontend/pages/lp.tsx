import LPInfoCard from '@components/Lp/LPInfoCard'
import Nav from '@components/Nav'
import { Typography, Box, Grid } from '@material-ui/core'
import { createStyles, makeStyles } from '@material-ui/core/styles'
import React from 'react'

const useStyles = makeStyles((theme) =>
  createStyles({
    container: {
      padding: theme.spacing(4, 12),
    },
    subHeading: {
      fontSize: '15px',
      color: theme.palette.text.secondary,
      lineHeight: '140%',
    },
    heading: {
      fontSize: '34px',
      lineHeight: '140%',
      fontWeight: 700,
    },
    poolValue: {
      fontSize: '27px',
      lineHeight: '140%',
      fontWeight: 700,
    },
    tradeCard: {
      backgroundColor: theme.palette.background.lightStone,
      padding: theme.spacing(2),
      borderRadius: theme.spacing(2),
      height: '100%',
    },
    infoBox: {
      padding: theme.spacing(2, 3),
      borderRadius: theme.spacing(2),
      border: `1px solid ${theme.palette.background.border}`,
    },
    poolDataItem: {
      borderRight: `1px solid ${theme.palette.background.border}`,
      padding: theme.spacing(0, 3),
      '&:last-child': {
        border: 'none',
      },
      '&:first-child': {
        paddingLeft: 0,
      },
    },
  }),
)

const LP: React.FC = () => {
  const classes = useStyles()

  return (
    <div>
      <Nav />
      <div className={classes.container}>
        <Box display="flex" alignItems="center" mb={4}>
          <Box mr={4}>
            <Typography className={classes.subHeading}>Earn fees passively</Typography>
            <Typography className={classes.heading}>Become an LP</Typography>
          </Box>
          <Box maxWidth={520} pl={4} borderLeft="1px solid #FFFFFF08">
            <Typography color="textSecondary">
              Become a liquidity provider in the SQTH-ETH pool on Uniswap v3. You can choose to Buy or Mint the Squeeth
              (oSQTH) you deposit.
            </Typography>
          </Box>
        </Box>
        <Grid container spacing={4}>
          <Grid item xs={12} lg={6}>
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <LPInfoCard title="Liquidation Price" value="$0.00" disabled />
              </Grid>
              <Grid item xs={6}>
                <LPInfoCard title="Realized P&L" value="$0.00" disabled />
              </Grid>
              <Grid item xs={6}>
                <LPInfoCard title="Ethereum (ETH) Price" value="$ 4200.50" />
              </Grid>
              <Grid item xs={6}>
                <LPInfoCard title="Position Size(oSQTH)" value="0.00" disabled />
              </Grid>
              <Grid item xs={12}>
                <Box className={classes.infoBox}>
                  <Typography className={classes.subHeading} style={{ marginBottom: '16px' }}>
                    Pool Details
                  </Typography>
                  <Box display="flex">
                    <div className={classes.poolDataItem}>
                      <Typography className={classes.poolValue}>$133.4m</Typography>
                      <Typography className={classes.subHeading}>ETH Deposited</Typography>
                    </div>
                    <div className={classes.poolDataItem}>
                      <Typography className={classes.poolValue}>$33.4m</Typography>
                      <Typography className={classes.subHeading}>oSQTH Minted</Typography>
                    </div>
                    <div className={classes.poolDataItem}>
                      <Typography className={classes.poolValue}>1.2k</Typography>
                      <Typography className={classes.subHeading}>Depositors</Typography>
                    </div>
                  </Box>
                </Box>
              </Grid>
            </Grid>
          </Grid>
          <Grid item xs={12} lg={5}>
            <Box className={classes.tradeCard}>Trade Page goes here</Box>
          </Grid>
        </Grid>
      </div>
    </div>
  )
}

export default LP
