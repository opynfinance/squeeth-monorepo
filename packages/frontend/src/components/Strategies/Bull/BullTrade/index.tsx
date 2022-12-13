import { Box, Tooltip, Typography } from '@material-ui/core'
import { createStyles, makeStyles } from '@material-ui/core/styles'
import BigNumber from 'bignumber.js'
import React, { useRef, useState } from 'react'
import { useAtomValue } from 'jotai'
import InfoIcon from '@material-ui/icons/Info'

import { PrimaryButtonNew } from '@components/Button'
import { SqueethTabsNew, SqueethTabNew } from '@components/Tabs'
import Confirmed, { ConfirmType } from '@components/Trade/Confirmed'
import { TradeSettings } from '@components/TradeSettings'
import RestrictionInfo from '@components/RestrictionInfo'
import { InputToken } from '@components/InputNew'
import { LinkWrapper } from '@components/LinkWrapper'
import Metric from '@components/Metric'
import { useSelectWallet } from '@state/wallet/hooks'
import { indexAtom } from '@state/controller/atoms'
import { BIG_ZERO } from '@constants/index'
import { toTokenAmount } from '@utils/calculations'
import { formatNumber } from '@utils/formatter'
import ethLogo from 'public/images/eth-logo.svg'
import { useBullFlashDeposit, useGetFlashBulldepositParams } from '@state/bull/hooks'
import debounce from 'lodash/debounce'
import BullDepsoit from './Deposit'
import BullWithdraw from './Withdraw'

const useStyles = makeStyles((theme) =>
  createStyles({
    container: {
      padding: theme.spacing(2),
    },
    tradeContainer: {
      display: 'flex',
      flexDirection: 'column',
    },
    tabBackGround: {
      position: 'sticky',
      top: '0',
      zIndex: 20,
    },
    notice: {
      marginTop: theme.spacing(2.5),
      padding: theme.spacing(2),
      border: `1px solid #F3FF6C`,
      borderRadius: theme.spacing(1),
      display: 'flex',
      background: 'rgba(243, 255, 108, 0.1)',
      alignItems: 'center',
    },
    infoIcon: {
      marginRight: theme.spacing(2),
      color: '#F3FF6C',
    },
    subtitle: {
      fontSize: '20px',
      fontWeight: 700,
      letterSpacing: '-0.01em',
    },
    infoText: {
      fontWeight: 500,
      fontSize: '13px',
    },
    slippageContainer: {
      [theme.breakpoints.down('xs')]: {
        flexWrap: 'wrap',
      },
    },
  }),
)

type BullTrade = {
  maxCap: BigNumber
  depositedAmount: BigNumber
}

enum BullTradeType {
  Deposit = 'Deposit',
  Withdraw = 'Withdraw',
}

const BullTrade: React.FC<BullTrade> = ({ maxCap, depositedAmount }) => {
  const [tradeType, setTradeType] = useState(BullTradeType.Deposit)
  const isDeposit = tradeType === BullTradeType.Deposit
  const tabValue = tradeType === BullTradeType.Deposit ? 0 : 1

  const classes = useStyles()
  const confirmed = false

  return (
    <>
      {confirmed ? (
        <>
          <Confirmed confirmationMessage={`Confirmation Message`} txnHash={''} confirmType={ConfirmType.BULL} />
          <PrimaryButtonNew fullWidth id="bull-close-btn" variant="contained">
            Close
          </PrimaryButtonNew>
        </>
      ) : (
        <>
          <SqueethTabsNew
            value={tabValue}
            onChange={(_, val) => setTradeType(val === 0 ? BullTradeType.Deposit : BullTradeType.Withdraw)}
            aria-label="bull trade tabs"
            centered
            variant="fullWidth"
            className={classes.tabBackGround}
          >
            <SqueethTabNew id="bull-deposit-tab" label="Deposit" />
            <SqueethTabNew id="bull-withdraw-tab" label="Withdraw" />
          </SqueethTabsNew>
          {isDeposit ? <BullDepsoit /> : <BullWithdraw />}
        </>
      )}
    </>
  )
}

export default BullTrade
