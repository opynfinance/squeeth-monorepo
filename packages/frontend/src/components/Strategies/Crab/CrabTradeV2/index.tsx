import { Box } from '@material-ui/core'
import React, { useState, useEffect } from 'react'
import { SqueethTabsNew, SqueethTabNew } from '@components/Tabs'
import BigNumber from 'bignumber.js'

import { useSetStrategyDataV2 } from '@state/crab/hooks'
import Deposit from './Deposit'
import Withdraw from './Withdraw'

type CrabTradeProps = {
  maxCap: BigNumber
  depositedAmount: BigNumber
}

const CrabTradeV2: React.FC<CrabTradeProps> = ({ maxCap, depositedAmount }) => {
  const [depositOption, setDepositOption] = useState(0)
  const setStrategyData = useSetStrategyDataV2()

  useEffect(() => {
    setStrategyData()
  }, [])

  return (
    <>
      <SqueethTabsNew
        value={depositOption}
        onChange={(event, val) => setDepositOption(val)}
        aria-label="crab-trade-tab"
        centered
        variant="fullWidth"
      >
        <SqueethTabNew id="crab-deposit-tab" label="Deposit" />
        <SqueethTabNew id="crab-withdraw-tab" label="Withdraw" />
      </SqueethTabsNew>

      <Box marginTop="32px">
        {depositOption === 0 ? <Deposit maxCap={maxCap} depositedAmount={depositedAmount} /> : <Withdraw />}
      </Box>
    </>
  )
}

export default CrabTradeV2
