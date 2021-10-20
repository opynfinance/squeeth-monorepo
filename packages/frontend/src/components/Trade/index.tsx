import { createStyles, Fade, makeStyles, Modal } from '@material-ui/core'
import Backdrop from '@material-ui/core/Backdrop'
import React from 'react'
import { useMemo, useState } from 'react'

import { useTrade } from '../../context/trade'
import { useWallet } from '../../context/wallet'
import { useLongPositions, useShortPositions } from '../../hooks/usePositions'
import { TradeType } from '../../types'
import { toTokenAmount } from '../../utils/calculations'
import { SecondaryTab, SecondaryTabs } from '../Tabs'
import History from './History'
import Long from './Long'
import Short from './Short'

const useStyles = makeStyles((theme) =>
  createStyles({
    modal: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    },
    paper: {
      backgroundColor: theme.palette.background.paper,
      boxShadow: theme.shadows[5],
      padding: theme.spacing(2, 4),
      borderRadius: theme.spacing(1),
      width: '40rem',
      height: '60vh',
    },
  }),
)

const Trade: React.FC = () => {
  const [modelOpen, setModelOpen] = useState(false)
  const classes = useStyles()
  const { balance } = useWallet()
  const { squeethAmount: lngAmt } = useLongPositions()
  const { squeethAmount: shrtAmt } = useShortPositions()
  const { tradeType, openPosition, setOpenPosition } = useTrade()

  const showOpenCloseTabs = useMemo(() => {
    return (tradeType === TradeType.LONG && shrtAmt.isZero()) || (tradeType === TradeType.SHORT && lngAmt.isZero())
  }, [tradeType, lngAmt.toNumber(), shrtAmt.toNumber()])

  return (
    <div>
      {showOpenCloseTabs ? (
        <SecondaryTabs
          value={openPosition}
          onChange={(evt, val) => setOpenPosition(val)}
          aria-label="simple tabs example"
          centered
          variant="fullWidth"
        >
          <SecondaryTab label="Open" />
          <SecondaryTab label="Close" />
        </SecondaryTabs>
      ) : null}
      <div>
        {tradeType === TradeType.LONG ? (
          shrtAmt.isZero() ? (
            <Long
              balance={Number(toTokenAmount(balance, 18).toFixed(4))}
              open={openPosition === 0}
              closeTitle="Close squeeth position and redeem ETH"
            />
          ) : (
            <Short
              balance={Number(toTokenAmount(balance, 18).toFixed(4))}
              open={false}
              closeTitle="You already have short position, close it to open a long position"
            />
          )
        ) : lngAmt.isZero() ? (
          <Short
            balance={Number(toTokenAmount(balance, 18).toFixed(4))}
            open={openPosition === 0}
            closeTitle="Buy back and close position"
          />
        ) : (
          <Long
            balance={Number(toTokenAmount(balance, 18).toFixed(4))}
            open={false}
            closeTitle="You already have long position, close it to open short position"
          />
        )}
        <Modal
          aria-labelledby="enable-notification"
          open={modelOpen}
          className={classes.modal}
          onClose={() => setModelOpen(false)}
          closeAfterTransition
          BackdropComponent={Backdrop}
          BackdropProps={{
            timeout: 500,
          }}
        >
          <Fade in={modelOpen}>
            <div className={classes.paper}>
              <History />
            </div>
          </Fade>
        </Modal>
      </div>
    </div>
  )
}

export default Trade
