import { createStyles, makeStyles } from '@material-ui/core'
import dynamic from 'next/dynamic'
import React, { useState } from 'react'
import CustomSwitch from '@components/CustomSwitch'
import { useNormHistory } from '@hooks/useNormHistory'
import { NormHistory } from '../../types/index'
import { graphOptions } from '../../constants/diagram'

const Chart = dynamic(() => import('kaktana-react-lightweight-charts'), { ssr: false })

const useStyles = makeStyles((theme) =>
  createStyles({
    switchWrapper: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      flexWrap: 'wrap',
    },
    legendBox: {
      display: 'flex',
      gap: '10px',
      marginTop: '10px',
      justifyContent: 'center',
    },
    legendContainer: {
      display: 'flex',
      gap: '5px',
    },
  }),
)

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

  const normFactors: NormHistory[] = useNormHistory()
  const graphData = normFactors.map((item) => {
    const secondsElapsed = Number(item.timestamp) - Number(item.lastModificationTimestamp)
    const deltaT = secondsElapsed / (420 * 60 * 60)
    const markIndex = 1 / Math.exp(Math.log(Number(item.newNormFactor) / Number(item.oldNormFactor)) / deltaT)
    const dayFunding = Math.log(markIndex) / 17.5
    const monthFunding = dayFunding * 30
    const yearFunding = dayFunding * 365.25
    const annualVol = Math.sqrt(dayFunding * 365)
    const value =
      fundingType.id === 'vol'
        ? annualVol
        : fundingDuration.id === '1d'
        ? dayFunding
        : fundingDuration.id === '1m'
        ? monthFunding
        : yearFunding
    return { time: Number(item.timestamp), value }
  })
  const chartOptions = {
    ...graphOptions,
    localization: {
      priceFormatter: (num: number) => (num < 0 ? num.toFixed(5) : num.toFixed(6)),
    },
  }
  const startTimestamp = normFactors.length > 0 ? Number(normFactors[0].timestamp) : undefined
  const endTimestamp = normFactors.length > 0 ? Number(normFactors[normFactors.length - 1].timestamp) : undefined

  return (
    <>
      <div style={{ width: '100%' }}>
        <div className={classes.switchWrapper}>
          <CustomSwitch items={fundingTypes} value={fundingType} onChange={setFundingType} />
          {fundingType.id === 'funding' && (
            <CustomSwitch items={fundingDurations} value={fundingDuration} onChange={setFundingDuration} />
          )}
        </div>
        {graphData && graphData.length > 0 && (
          <>
            <Chart
              from={startTimestamp}
              to={endTimestamp}
              legend=""
              options={chartOptions}
              lineSeries={[{ data: graphData }]}
              autoWidth
              height={300}
              darkTheme
            />
            <div className={classes.legendBox}>
              <div className={classes.legendContainer}>
                <div style={{ width: '20px', height: '20px', backgroundColor: '#018FFB' }}></div>
                <div>
                  {fundingType.id === 'vol'
                    ? 'Annual Vol(rhs)'
                    : fundingDuration.id === '1d'
                    ? 'Daily Funding'
                    : fundingDuration.id === '1m'
                    ? 'Monthly Funding'
                    : 'Annual Funding'}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  )
}

export default FundingChart
