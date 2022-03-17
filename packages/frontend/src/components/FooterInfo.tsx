import { useController } from '@hooks/contracts/useController'
import { useSqueethPool } from '@hooks/contracts/useSqueethPool'
import { Typography } from '@material-ui/core'
import { createStyles, makeStyles } from '@material-ui/core/styles'
import { toTokenAmount } from '@utils/calculations'
import React from 'react'
import { useMemo } from 'react'

const useStyles = makeStyles((theme) =>
  createStyles({
    container: {
      padding: theme.spacing(2),
      position: 'fixed',
      bottom: '0',
      display: 'flex',
      borderTop: `1px solid ${theme.palette.background.border}`,
      width: '100%',
      alignItems: 'center',
      overflow: 'auto',
      whiteSpace: 'nowrap',
    },
    value: {
      fontWeight: 500,
      marginLeft: theme.spacing(1),
    },
    footerItem: {
      display: 'flex',
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

const FooterItem: React.FC<{ title: string; value: string }> = ({ title, value }) => {
  const classes = useStyles()

  return (
    <div className={classes.footerItem}>
      <Typography variant="caption" color="textSecondary">
        {title}
      </Typography>
      <Typography variant="body2" className={classes.value}>
        {value}
      </Typography>
    </div>
  )
}

const FooterInfo = React.memo(function FooterInfo() {
  const classes = useStyles()
  const { mark, index, impliedVol, normFactor, dailyHistoricalFunding } = useController()
  const { getWSqueethPositionValue, getWSqueethPositionValueInETH } = useSqueethPool()

  const oSqthPriceUsd = useMemo(() => getWSqueethPositionValue(1), [getWSqueethPositionValue])
  const oSqthPriceEth = useMemo(() => getWSqueethPositionValueInETH(1), [getWSqueethPositionValueInETH])

  return (
    <div className={classes.container}>
      <FooterItem title="ETH Price" value={`$${Number(toTokenAmount(index, 18).sqrt()).toFixed(2).toLocaleString()}`} />
      <FooterItem title="Mark Price" value={`$${Number(toTokenAmount(mark, 18).toFixed(0)).toLocaleString()}`} />
      <FooterItem title="ETH² Price" value={`$${Number(toTokenAmount(index, 18).toFixed(0)).toLocaleString()}`} />
      <FooterItem title="Implied Volatility" value={`${(impliedVol * 100).toFixed(2)}%`} />
      <FooterItem
        title="oSQTH Price (USD)"
        value={!oSqthPriceUsd.isZero() ? `$${Number(oSqthPriceUsd.toFixed(2).toLocaleString())}` : 'loading'}
      />
      <FooterItem
        title="oSQTH Price (ETH)"
        value={!oSqthPriceEth.isZero() ? `${Number(oSqthPriceEth.toFixed(2).toLocaleString())} Ξ` : 'loading'}
      />
      <FooterItem title="24H Funding" value={(dailyHistoricalFunding.funding * 100).toFixed(2)} />
      <FooterItem title="Norm Factor" value={normFactor.toFixed(4)} />
    </div>
  )
})

export default FooterInfo
