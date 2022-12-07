import React from 'react'
import { Typography, Box } from '@material-ui/core'
import { createStyles, makeStyles } from '@material-ui/core/styles'
import { useAtomValue } from 'jotai'
import Link from 'next/link'

import { squeethLiquidityAtom, wethLiquidityAtom } from '@state/positions/atoms'
import { useLPPositionsQuery } from '@state/positions/hooks'
import Metric from '@components/Metric'
import { formatNumber } from '@utils/formatter'

const useStyles = makeStyles((theme) =>
  createStyles({
    link: {
      color: theme.palette.primary.main,
      fontWeight: 500,
      fontSize: '14px',
    },
    subtitle: {
      fontSize: '20px',
      fontWeight: 700,
      letterSpacing: '-0.01em',
    },
  }),
)

const LPPosition: React.FC = () => {
  const classes = useStyles()
  const squeethLiquidity = useAtomValue(squeethLiquidityAtom)
  const wethLiquidity = useAtomValue(wethLiquidityAtom)
  const { loading } = useLPPositionsQuery()

  if (loading) {
    return <div>{'Fetching LP position...'}</div>
  }

  if (squeethLiquidity.isZero() && wethLiquidity.isZero()) {
    return null
  }

  return (
    <>
      <Box display="flex" alignItems="center" gridGap="32px">
        <Typography variant="h4" className={classes.subtitle}>
          My Position
        </Typography>
        <Typography className={classes.link} id="pos-card-manage-vault-link">
          <Link href={`/positions`}>Sell full position</Link>
        </Typography>
      </Box>

      <Box display="flex" gridGap="12px" marginTop="16px" flexWrap="wrap">
        <Metric gridGap="6px" label="oSQTH Liquidity" value={formatNumber(squeethLiquidity.toNumber(), 4) + ' oSQTH'} />
        <Metric gridGap="6px" label="WETH Liquidity" value={formatNumber(wethLiquidity.toNumber(), 4) + ' WETH'} />
      </Box>
    </>
  )
}

export default LPPosition
