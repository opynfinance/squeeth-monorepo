import { Accordion, AccordionDetails, AccordionSummary, createStyles, makeStyles, Typography } from '@material-ui/core'
import ExpandMoreIcon from '@material-ui/icons/ExpandMore'
import React from 'react'

import { UNI_POOL_FEES } from '../../constants'
import TradeInfoItem from './TradeInfoItem'

type UniswapDataType = {
  slippage: string
  priceImpact: string
  minReceived: string
  minReceivedUnit: string
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

const UniswapData: React.FC<UniswapDataType> = ({ slippage, priceImpact, minReceived, minReceivedUnit }) => {
  const classes = useStyles()
  const [expanded, setExpanded] = React.useState(false)

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
                <Typography variant="caption">{priceImpact}%</Typography>
              </>
            )}
          </div>
        </AccordionSummary>
        <AccordionDetails classes={{ root: classes.detailsRoot }}>
          <div style={{ width: '100%' }}>
            <TradeInfoItem label="Allowed Slippage" value={slippage} unit="%" />
            <TradeInfoItem label="Price Impact" value={priceImpact} unit="%" />
            <TradeInfoItem label="Min received" value={minReceived} unit={minReceivedUnit} />
            <TradeInfoItem label="Uniswap V3 LP Fee" value={UNI_POOL_FEES / 10000} unit="%" />
          </div>
        </AccordionDetails>
      </Accordion>
    </div>
  )
}

export default UniswapData
