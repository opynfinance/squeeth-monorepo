import { memo } from 'react'
import { createStyles, makeStyles, Tooltip } from '@material-ui/core'
import InfoIcon from '@material-ui/icons/InfoOutlined'
import dynamic from 'next/dynamic'
import React, { useState } from 'react'
import CustomSwitch, { SwitchItem } from '@components/CustomSwitch'
import { useNormHistory } from '@hooks/useNormHistory'
import { Tooltips } from '@constants/enums'
import { NormHistory } from '../../types/index'
import { graphOptions } from '../../constants/diagram'

const Chart = dynamic(() => import('kaktana-react-lightweight-charts'), { ssr: false })

const useStyles = makeStyles(() =>
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
    iconWrapper: {
      display: 'flex',
      marginLeft: 6,
    },
  }),
)

const FundingChart = () => {
  const classes = useStyles()

  const fundingTypes = [
    { id: 'funding', text: 'Premium' },
    {
      id: 'vol',
      text: 'VOL',
      itemToAdd: (
        <div className={classes.iconWrapper}>
          <Tooltip title={Tooltips.FundingVol}>
            <InfoIcon fontSize="small" />
          </Tooltip>
        </div>
      ),
    },
  ]
  const fundingDurations = [
    {
      id: 'day',
      text: 'Day',
      itemToAdd: (
        <div className={classes.iconWrapper}>
          <Tooltip title={Tooltips.FundingDaily}>
            <InfoIcon fontSize="small" />
          </Tooltip>
        </div>
      ),
    },
    {
      id: 'month',
      text: 'Month',
      itemToAdd: (
        <div className={classes.iconWrapper}>
          <Tooltip title={Tooltips.FundingMonthly}>
            <InfoIcon fontSize="small" />
          </Tooltip>
        </div>
      ),
    },
    {
      id: 'year',
      text: 'Annualized',
      itemToAdd: (
        <div className={classes.iconWrapper}>
          <Tooltip title={Tooltips.FundingAnnual}>
            <InfoIcon fontSize="small" />
          </Tooltip>
        </div>
      ),
    },
  ]
  const [fundingType, setFundingType] = useState<SwitchItem>(fundingTypes[0])
  const [fundingDuration, setFundingDuration] = useState<SwitchItem>(fundingDurations[0])

  const normFactors: NormHistory[] = useNormHistory()
  const graphData = normFactors.map((item) => {
    const secondsElapsed = Number(item.timestamp) - Number(item.lastModificationTimestamp)
    const deltaT = secondsElapsed / (420 * 60 * 60)
    const markIndex = 1 / Math.exp(Math.log(Number(item.newNormFactor) / Number(item.oldNormFactor)) / deltaT)
    const dayFunding = Math.log(markIndex) / 17.5
    const monthFunding = dayFunding * 30
    const yearFunding = dayFunding * 365.25
    const annualVol = (dayFunding < 0 ? -1 : 1) * Math.sqrt(Math.abs(dayFunding) * 365)
    const value =
      (fundingType.id === 'vol'
        ? annualVol
        : fundingDuration.id === 'day'
        ? dayFunding
        : fundingDuration.id === 'month'
        ? monthFunding
        : yearFunding) * 100
    return { time: Number(item.timestamp), value }
  })
  const chartOptions = {
    ...graphOptions,
    localization: {
      priceFormatter: (num: number) => `${num < 0 ? num.toFixed(3) : num.toFixed(4)}%`,
    },
  }
  const startTimestamp = normFactors.length > 0 ? Number(normFactors[0].timestamp) : undefined
  const endTimestamp = normFactors.length > 0 ? Number(normFactors[normFactors.length - 1].timestamp) : undefined
  const legendText =
    fundingType.id === 'vol'
      ? 'Annual Vol'
      : fundingDuration.id === 'day'
      ? 'Daily Funding'
      : fundingDuration.id === 'month'
      ? 'Monthly Funding'
      : 'Annual Funding'

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
              lineSeries={[{ data: graphData, legend: `${legendText} (%) ` }]}
              autoWidth
              height={300}
              darkTheme
            />
            <div className={classes.legendBox}>
              <div className={classes.legendContainer}>
                <div style={{ width: '20px', height: '20px', backgroundColor: '#018FFB' }}></div>
                <div>{legendText}</div>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  )
}

export default memo(FundingChart)
