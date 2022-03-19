import { createStyles, makeStyles } from '@material-ui/core'
import React from 'react'

// import { useWallet } from '@context/wallet'
// import { usePositions } from '@context/positions'
import { TradeType } from '../../types'
import { SecondaryTab, SecondaryTabs } from '../Tabs'
import Long from './Long'
import Short from './Short'
import { ethTradeAmountAtom, openPositionAtom, sqthTradeAmountAtom, tradeTypeAtom } from 'src/state/trade/atoms'
import { useAtom, useAtomValue } from 'jotai'
import { useResetAtom } from 'jotai/utils'
import { isTransactionFirstStepAtom, transactionDataAtom, transactionLoadingAtom } from 'src/state/wallet/atoms'

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
    tabBackGround: {
      position: 'sticky',
      top: '0',
      zIndex: 20,
      background: '#2A2D2E',
    },
    displayBlock: {
      display: 'block',
    },
    displayNone: {
      display: 'none',
    },
  }),
)

const Trade: React.FC = () => {
  const classes = useStyles()

  // const { data: balance } = useWalletBalance()
  const resetEthTradeAmount = useResetAtom(ethTradeAmountAtom)
  const resetSqthTradeAmount = useResetAtom(sqthTradeAmountAtom)
  const tradeType = useAtomValue(tradeTypeAtom)
  const [openPosition, setOpenPosition] = useAtom(openPositionAtom)
  const resetTransactionData = useResetAtom(transactionDataAtom)
  const transactionInProgress = useAtomValue(transactionLoadingAtom)
  const isTxFirstStep = useAtomValue(isTransactionFirstStepAtom)

  // useEffect(() => {
  //   setTradeType(positionType === PositionType.SHORT ? 1 : 0)
  // }, [positionType])

  return (
    <div>
      {
        <SecondaryTabs
          value={openPosition}
          onChange={(evt, val) => {
            setOpenPosition(val)

            if (!transactionInProgress || !isTxFirstStep) {
              resetEthTradeAmount()
              resetSqthTradeAmount()
              resetTransactionData()
            }
          }}
          aria-label="simple tabs example"
          centered
          variant="fullWidth"
          className={classes.tabBackGround}
        >
          <SecondaryTab label="Open" id="open-btn" />
          <SecondaryTab label="Close" id="close-btn" />
        </SecondaryTabs>
      }
      <div>
        {tradeType === TradeType.LONG ? (
          <Long
            // balance={Number(toTokenAmount(balance ?? BIG_ZERO, 18).toFixed(4))}
            open={openPosition === 0}
            // closeTitle="Sell squeeth ERC20 to get ETH"
          />
        ) : (
          <Short
            // balance={Number(toTokenAmount(balance ?? BIG_ZERO, 18).toFixed(4))}
            open={openPosition === 0}
            // closeTitle="Buy back oSQTH & close position"
          />
        )}

        {/* <div className={tradeType !== TradeType.LONG ? classes.displayBlock : classes.displayNone}></div> */}
      </div>
    </div>
  )
}

export default Trade
