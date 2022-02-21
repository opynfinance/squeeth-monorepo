import { createStyles, makeStyles, TextField, Tooltip, Typography } from '@material-ui/core'
import dynamic from 'next/dynamic'
import React, { useEffect, useMemo, useState } from 'react'
import CustomSwitch from '@components/CustomSwitch'
import { useNormHistory } from '@hooks/useNormHistory'
import { NormHistory } from '../../types/index'

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

  const normFactors = useNormHistory()
  const dailyFundings = normFactors.map((item: NormHistory) => {
    const secondsElapsed = Number(item.timestamp) - Number(item.lastModificationTimestamp)
    const deltaT = secondsElapsed / (420 * 60 * 60)
    const markIndex = 1 / Math.exp(Math.log(Number(item.newNormFactor) / Number(item.oldNormFactor)) / deltaT)
    return Math.log(markIndex) / 17.5
  })

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
