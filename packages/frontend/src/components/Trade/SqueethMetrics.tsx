import React from 'react'
import { Box, BoxProps } from '@material-ui/core'
import { useAtomValue } from 'jotai'

import { normFactorAtom, indexForSettlementAtom } from '@state/controller/atoms'
import { formatCurrency, formatNumber } from '@utils/formatter'
import Metric, { MetricLabel } from '@components/Metric'
import { Tooltips } from '@constants/enums'
import { INDEX_SCALE } from '@constants/index'

const SqueethMetrics: React.FC<BoxProps> = (props) => {
  const normFactor = useAtomValue(normFactorAtom)
  const indexForSettlement = useAtomValue(indexForSettlementAtom)

  return (
    <Box display="flex" alignItems="center" flexWrap="wrap" gridGap="12px" {...props}>
      <Metric
        label={<MetricLabel label="ETH Settlement Price" tooltipTitle={'ETH Settlement Price'} />}
        value={formatCurrency(indexForSettlement.times(INDEX_SCALE).toNumber())}
      />

      <Metric
        label={<MetricLabel label="Norm Factor" tooltipTitle={Tooltips.NormFactor} />}
        value={normFactor.isFinite() ? formatNumber(normFactor.toNumber(), 4) : ''}
      />
    </Box>
  )
}

export default SqueethMetrics
