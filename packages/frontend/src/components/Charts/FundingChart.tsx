import { createStyles, makeStyles, TextField, Tooltip, Typography } from '@material-ui/core'
import dynamic from 'next/dynamic'
import React, { useEffect, useMemo, useState } from 'react'
import CustomSwitch from '@components/CustomSwitch'
import { getTimestampAgo } from '@utils/index'
import { useNormHistory } from '@hooks/useNormHistory'

const Chart = dynamic(() => import('kaktana-react-lightweight-charts'), { ssr: false })

const useStyles = makeStyles((theme) => createStyles({}))

const FundingChart = () => {
  const fundingTypes = [
    { id: 'funding', text: 'Funding' },
    { id: 'vol', text: 'VOL' },
  ]
  const fundingDurations = [
    { id: '1d', text: 'Day' },
    { id: '1m', text: 'Month' },
    { id: '1y', text: 'Annual' },
  ]
  const [fundingType, setFundingType] = useState(fundingTypes[0])
  const [fundingDuration, setFundingDuration] = useState(fundingDurations[0])
  const classes = useStyles()

  const timeAgo = getTimestampAgo(
    1,
    fundingDuration.id === '1y' ? 'year' : fundingDuration.id === '1m' ? 'month' : 'day',
  )

  const { data: normHistoryData } = useNormHistory(timeAgo - 1000)
  const normFactors = normHistoryData ? normHistoryData['normalizationFactorUpdates'] || [] : []
  const dailyFundings = normFactors
    .map((item: any, index: number) => {
      if (index < 1) return
      const secondsElapsed = item.timestamp - normFactors[index - 1].timestamp
      const deltaT = secondsElapsed / (420 * 60 * 60)
      const markIndex = 1 / Math.exp(Math.log(item.newNormFactor / item.oldNormFactor) / deltaT)
      return Math.log(markIndex) / 17.5
    })
    .filter((funding: number | undefined) => !!funding)
  console.log('ccc', dailyFundings)

  return (
    <>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between' }}>
          <CustomSwitch items={fundingTypes} value={fundingType} onChange={setFundingType} />
          <CustomSwitch items={fundingDurations} value={fundingDuration} onChange={setFundingDuration} />
        </div>
      </div>
    </>
  )
}

export default FundingChart
