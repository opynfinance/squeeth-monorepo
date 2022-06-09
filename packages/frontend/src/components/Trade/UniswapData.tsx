import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  createStyles,
  makeStyles,
  Typography,
  useTheme,
} from '@material-ui/core'
import ExpandMoreIcon from '@material-ui/icons/ExpandMore'
import React, { useMemo } from 'react'

import TradeInfoItem from './TradeInfoItem'

type UniswapDataType = {
  slippage: string
  priceImpact: string
  minReceived: string
  minReceivedUnit: string
  isMaxSent?: boolean
  pools?: Array<any>
}

const useStyles = makeStyles((theme) =>
  createStyles({
    pi: {
      marginLeft: theme.spacing(2),
    },
    container: {
      border: `1px solid ${theme.palette.background.stone}`,
      borderRadius: theme.spacing(1),
    },
    accordionRoot: {
      backgroundColor: 'transparent',
      borderRadius: theme.spacing(4),
      boxShadow: 'none',
      padding: theme.spacing(0),
    },
    accordionExpanded: {
      minHeight: '0px',
    },
    detailsRoot: {
      padding: theme.spacing(0, 2, 2, 2),
    },
  }),
)

const UniswapData: React.FC<UniswapDataType> = ({ slippage, priceImpact, minReceived, minReceivedUnit, isMaxSent, pools }) => {
  const classes = useStyles()
  const theme = useTheme()
  const [expanded, setExpanded] = React.useState(false)

  const priceImpactColor = useMemo(() => {
    const priceImpactNum = Number(priceImpact)
    if (priceImpactNum > 2) return theme.palette.error.main
    if (priceImpactNum < 1) return theme.palette.success.main
    return theme.palette.warning.main
  }, [priceImpact, theme.palette.error.main, theme.palette.success.main, theme.palette.warning.main])

  const poolData = useMemo(() => 
    (pools && pools?.length > 1) ?
      pools.map((poolInfo, index) => 
      <TradeInfoItem label={poolInfo[2] + "% in " + poolInfo[0] + " Pool " + (index + 1)} value={poolInfo[1] / 10000} unit="%" tooltip="Pool selected by Uniswap Auto Router by optimizing swap price via split routes, multiple hops, and gas" />) : 
      pools ?    
      pools.map((poolInfo, index) => <TradeInfoItem label={"LP Fee (" + poolInfo[0] +")"} value={poolInfo[1] / 10000} unit="%" tooltip="Pool selected by Uniswap Auto Router by optimizing swap price via split routes, multiple hops, and gas" />) : 
    null, [pools])

   return (
    <div className={classes.container}>
      <Accordion
        classes={{ root: classes.accordionRoot, expanded: classes.accordionExpanded }}
        square={false}
        onChange={(_, e) => setExpanded(e)}
        expanded={expanded}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />} aria-controls="panel1a-content" id="panel1a-header">
          <div>
            {expanded ? (
              <Typography variant="caption">Uniswap transaction details</Typography>
            ) : (
              <>
                <Typography variant="caption" color="textSecondary">
                  Slippage:{' '}
                </Typography>
                <Typography variant="caption">{slippage}%</Typography>
                <Typography variant="caption" color="textSecondary" className={classes.pi}>
                  Price impact:{' '}
                </Typography>
                <Typography variant="caption" style={{ color: priceImpactColor, fontWeight: 600 }}>
                  {priceImpact}%
                </Typography>
              </>
            )}
          </div>
        </AccordionSummary>
        <AccordionDetails classes={{ root: classes.detailsRoot }}>
          <div style={{ width: '100%' }}>
            <TradeInfoItem label="Allowed Slippage" value={slippage} unit="%" />
            <TradeInfoItem label="Price Impact" value={priceImpact} unit="%" color={priceImpactColor} />
            <TradeInfoItem
              label={isMaxSent ? 'Maxmium sent' : 'Min received'}
              value={minReceived}
              unit={minReceivedUnit}
            />
            {poolData}
          </div>
        </AccordionDetails>
      </Accordion>
    </div>
  )
}

export default UniswapData
