import useAppMemo from '@hooks/useAppMemo'
import { getBreakEvenForLongSqueeth, toTokenAmount } from '@utils/calculations'
import { useAtomValue } from 'jotai'
import React from 'react'
import { currentImpliedFundingAtom, indexAtom, markAtom, normFactorAtom } from 'src/state/controller/atoms'
import TradeInfoItem from '../TradeInfoItem'

const BreakEven: React.FC = () => {
  const mark = useAtomValue(markAtom)
  const index = useAtomValue(indexAtom)
  const days = 1
  const normFactor = useAtomValue(normFactorAtom)
  const currentFunding = useAtomValue(currentImpliedFundingAtom)

  const breakEven = useAppMemo(() => {
    const breakEvenValue = getBreakEvenForLongSqueeth(mark, index, normFactor, days)
    const ethPrice = toTokenAmount(index, 18).sqrt()
    return (breakEvenValue / ethPrice.toNumber() - 1) * 100
  }, [index, mark, normFactor])

  return (
    <div>
      <TradeInfoItem
        label="ETH move to breakeven"
        value={breakEven.toFixed(3)}
        tooltip={`To breakeven ETH to needs to move to ${breakEven.toFixed(3)}% in one day, since current premiums are 
        ${(currentFunding * 100).toFixed(2)}%`}
        unit="%"
        id="open-long-eth-breakdown"
      />
    </div>
  )
}

export default BreakEven
