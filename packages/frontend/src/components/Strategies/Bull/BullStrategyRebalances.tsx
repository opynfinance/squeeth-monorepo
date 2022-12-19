import { IconButton, Typography, Link, Button, Box } from '@material-ui/core'
import { createStyles, makeStyles } from '@material-ui/core/styles'
import OpenInNewIcon from '@material-ui/icons/OpenInNew'
import React, { useCallback, useRef } from 'react'
import clsx from 'clsx'
import { useAtom, useAtomValue } from 'jotai'

import { EtherscanPrefix } from '@constants/index'
import { networkIdAtom } from '@state/wallet/atoms'
import { formatNumber } from '@utils/formatter'
import { visibleStrategyRebalancesAtom } from '@state/bull/atoms'
import { useBullHedgeHistory } from '@hooks/useBullHedgeHistory'
import { BullRebalanceType } from '../../../types'

const useMoreButtonStyles = makeStyles(() =>
  createStyles({
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

const useStyles = makeStyles((theme) =>
  createStyles({
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
    subtitle: {
      fontSize: '20px',
      fontWeight: 700,
      letterSpacing: '-0.01em',
    },
  }),
)

const MoreButton: React.FC<{ onClick?: () => void }> = ({ onClick }) => {
  const classes = useMoreButtonStyles()
  return (
    <div className={classes.moreButtonContainer}>
      <Button size="large" className={classes.moreButton} onClick={onClick} color="primary" variant="outlined">
        Load More
      </Button>
    </div>
  )
}

export const BullStrategyRebalances: React.FC = () => {
  const classes = useStyles()
  const [visibleRecords, setVisibleRecords] = useAtom(visibleStrategyRebalancesAtom)
  const { transactions } = useBullHedgeHistory() // use the bull strategy rebalances here
  const bottomRef = useRef<HTMLDivElement>(null)
  const networkId = useAtomValue(networkIdAtom)

  const onClickLoadMore = useCallback(() => {
    setVisibleRecords(visibleRecords + 3)
    setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, 200)
  }, [visibleRecords, setVisibleRecords])

  return (
    <Box>
      <Typography variant="h4" className={classes.subtitle}>
        Strategy Rebalances
      </Typography>
      <Box marginTop="24px">
        {transactions?.map((d) => {
          return (
            <div className={classes.statContainer} key={d.id}>
              <div className={classes.statHeader}>
                <Typography className={clsx(classes.statHeaderTitle)}>{d.type}</Typography>
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
                <Typography className={classes.label}>Is selling</Typography>
                <Typography className={classes.value}>
                  {d.isDepositingInCrab === true || d.isSellingUsdc === true ? 'Yes' : 'No'}
                </Typography>
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
        {/* {showMore && <MoreButton onClick={onClickLoadMore} />} */}
      </Box>
    </Box>
  )
}

export default BullStrategyRebalances
