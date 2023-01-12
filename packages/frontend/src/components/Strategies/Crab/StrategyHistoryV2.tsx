import { IconButton, Typography, Link, Button } from '@material-ui/core'
import { createStyles, makeStyles } from '@material-ui/core/styles'
import OpenInNewIcon from '@material-ui/icons/OpenInNew'
import React, { useRef, useCallback } from 'react'
import clsx from 'clsx'
import { useAtom, useAtomValue } from 'jotai'

import { EtherscanPrefix } from '@constants/index'
import { useCrabStrategyV2TxHistory } from '@hooks/useCrabV2AuctionHistory'
import { networkIdAtom } from '@state/wallet/atoms'
import { formatNumber } from '@utils/formatter'
import { visibleStrategyHedgesAtom } from '@state/crab/atoms'

const useStyles = makeStyles((theme) =>
  createStyles({
    container: {},
    statContainer: {
      background: theme.palette.background.stone,
      borderRadius: theme.spacing(1),
      padding: theme.spacing(1, 2),
      marginBottom: theme.spacing(1.5),
      display: 'flex',
      gap: '24px',
      flexWrap: 'wrap',
      flexDirection: 'row',
      [theme.breakpoints.down('xs')]: {
        flexDirection: 'column',
      },
    },
    statHeader: {
      flexBasis: '25%',
      minWidth: 'max-content',
    },
    statHeaderTitle: {
      color: 'rgba(255, 255, 255)',
      fontSize: '15px',
      fontWeight: 500,
      width: 'max-content',
      fontFamily: 'DM Sans',
    },
    stat: {
      display: 'flex',
      flexDirection: 'column',
      flex: 1,
      minWidth: 'max-content',
    },
    label: {
      color: 'rgba(255, 255, 255, 0.5)',
      fontSize: '14px',
      fontWeight: 500,
      width: 'max-content',
    },
    value: {
      color: 'rgba(255, 255, 255)',
      fontSize: '15px',
      fontWeight: 500,
      width: 'max-content',
      fontFamily: 'DM Mono',
    },
    txLink: {
      display: 'flex',
      alignItems: 'center',
      flexBasis: 'max-content',
    },
    moreButtonContainer: {
      display: 'flex',
      justifyContent: 'center',
      marginBottom: '24px',
    },
    moreButton: {
      textTransform: 'none',
    },
  }),
)

export const CrabStrategyV2History: React.FC = () => {
  const classes = useStyles()
  const [visibleHedges, setVisibleHedges] = useAtom(visibleStrategyHedgesAtom)
  const { data, showMore } = useCrabStrategyV2TxHistory()
  const bottomRef = useRef<HTMLDivElement>(null)
  const networkId = useAtomValue(networkIdAtom)

  const onClickLoadMore = useCallback(() => {
    setVisibleHedges(visibleHedges + 3)
    setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, 200)
  }, [visibleHedges, setVisibleHedges])

  return (
    <div className={classes.container}>
      {data?.map((d) => {
        return (
          <div className={classes.statContainer} key={d.id}>
            <div className={classes.statHeader}>
              <Typography className={clsx(classes.statHeaderTitle)}>
                {d.isBuying ? 'Bought oSQTH' : 'Sold oSQTH'}
              </Typography>
              <Typography className={classes.label}>
                {new Date(d.timestamp * 1000).toLocaleString(undefined, {
                  day: 'numeric',
                  month: 'short',
                  hour: 'numeric',
                  minute: 'numeric',
                })}
              </Typography>
            </div>

            <div className={classes.stat}>
              <Typography className={classes.label}>Size</Typography>
              <Typography className={classes.value}>{formatNumber(d.oSqueethAmount.toNumber(), 2)} oSQTH</Typography>
            </div>
            <div className={classes.stat}>
              <Typography className={classes.label}>Clearing price</Typography>
              <Typography className={classes.value}>{formatNumber(d.ethAmount.toNumber(), 2)} WETH</Typography>
            </div>

            <Link href={`${EtherscanPrefix[networkId]}${d.id}`} target="_blank" className={classes.txLink}>
              <Typography color="primary">View Transaction</Typography>
              <IconButton size="small">
                <OpenInNewIcon style={{ fontSize: '16px' }} color="primary" />
              </IconButton>
            </Link>
          </div>
        )
      })}
      <div ref={bottomRef} />
      {showMore && (
        <div className={classes.moreButtonContainer}>
          <Button
            size="large"
            className={classes.moreButton}
            onClick={onClickLoadMore}
            color="primary"
            variant="outlined"
          >
            Load More
          </Button>
        </div>
      )}
    </div>
  )
}

export default CrabStrategyV2History
