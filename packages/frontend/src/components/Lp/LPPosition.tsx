import { createStyles, makeStyles } from '@material-ui/core/styles'
import { useAtomValue } from 'jotai'
import React from 'react'
import { Typography } from '@material-ui/core'
import Link from 'next/link'

import { squeethLiquidityAtom, wethLiquidityAtom } from 'src/state/positions/atoms'
import { useLPPositionsQuery } from 'src/state/positions/hooks'

const useStyles = makeStyles((theme) =>
  createStyles({
    container: {},
    link: {
      marginTop: theme.spacing(2),
      color: theme.palette.primary.main,
    },
  }),
)

const LPPosition: React.FC = () => {
  const classes = useStyles()
  const squeethLiquidity = useAtomValue(squeethLiquidityAtom)
  const wethLiquidity = useAtomValue(wethLiquidityAtom)
  const { loading } = useLPPositionsQuery()

  if (loading) return <div className={classes.container}>Loading...</div>

  if (squeethLiquidity.isZero() && wethLiquidity.isZero())
    return <div className={classes.container}>No LP Positions</div>

  return (
    <div className={classes.container}>
      <Typography variant="body1" style={{ fontWeight: 600 }}>
        Position
      </Typography>
      <div style={{ display: 'flex', marginTop: '8px' }}>
        <Typography>Liquidity: &nbsp;</Typography>
        <Typography>
          <span style={{ fontWeight: 600 }}>{' ' + squeethLiquidity.toFixed(4)}</span> oSQTH,&nbsp;
        </Typography>
        <Typography>
          <span style={{ fontWeight: 600 }}>{' ' + wethLiquidity.toFixed(4)}</span> WETH
        </Typography>
      </div>
      <Typography className={classes.link}>
        <Link href={`positions/`}>See full position</Link>
      </Typography>
    </div>
  )
}

export default LPPosition
