import useAppMemo from '@hooks/useAppMemo'
import { getBreakEvenForLongSqueeth, toTokenAmount } from '@utils/calculations'
import { useAtomValue } from 'jotai'
import React from 'react'
import { indexAtom, markAtom, normFactorAtom } from 'src/state/controller/atoms'
import { useCurrentImpliedFunding } from 'src/state/controller/hooks'
import TradeInfoItem from '../TradeInfoItem'

const BreakEven: React.FC = () => {
  const mark = useAtomValue(markAtom)
  const index = useAtomValue(indexAtom)
  const days = 1
  const normFactor = useAtomValue(normFactorAtom)
  const { currentImpliedFunding: currentFunding } = useCurrentImpliedFunding()

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
        tooltip={`To breakeven ETH to needs to move to ${breakEven.toFixed(3)}% in one day, since current funding is 
        ${(currentFunding * 100).toFixed(2)}%`}
        unit="%"
        id="open-long-eth-breakdown"
      />
    </div>
  )
}

export default BreakEven
