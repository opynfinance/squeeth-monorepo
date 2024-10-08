import React, { useState } from 'react'
import { Box, Fade, Typography } from '@material-ui/core'
import { makeStyles, createStyles } from '@material-ui/core/styles'
import KeyboardArrowUpIcon from '@material-ui/icons/KeyboardArrowUp'
import KeyboardArrowDownIcon from '@material-ui/icons/KeyboardArrowDown'
import { useAtomValue } from 'jotai'

import Metric, { MetricLabel } from '@components/Metric'
import { TextButton } from '@components/Button'
import { impliedVolAtom, impliedVolatilityShutdownAtom, osqthRefVolAtom } from '@state/controller/atoms'
import { formatNumber } from '@utils/formatter'
import { Tooltips } from '@constants/enums'
import { bullCurrentFundingAtom } from '@state/bull/atoms'
import useAmplitude from '@hooks/useAmplitude'
import { SITE_EVENTS } from '@utils/amplitude'

const useStyles = makeStyles(() =>
  createStyles({
    button: {
      color: 'rgba(255, 255, 255, 0.5)',
    },
    buttonText: {
      color: 'rgba(255, 255, 255, 0.5)',
      fontSize: '15px',
      fontWeight: 500,
      marginRight: '4px',
    },
  }),
)

const AdvancedMetrics: React.FC = () => {
  const [showAdvanced, setShowAdvanced] = useState(false)

  const impliedVolatilityShutdown = useAtomValue(impliedVolatilityShutdownAtom)
  const osqthRefVol = useAtomValue(osqthRefVolAtom)
  const currentImpliedFunding = useAtomValue(bullCurrentFundingAtom)
  const { track } = useAmplitude()

  const classes = useStyles()

  const impliedVolShutdownPercent = impliedVolatilityShutdown * 100

  return (
    <div>
      <TextButton
        className={classes.button}
        onClick={() => {
          setShowAdvanced(!showAdvanced)
          !showAdvanced ? track(SITE_EVENTS.SEE_ADVANCED_METRICS_BULL) : null
        }}
      >
        <Typography className={classes.buttonText}>Advanced</Typography>{' '}
        {showAdvanced ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
      </TextButton>

      <Fade in={showAdvanced}>
        {showAdvanced ? (
          <Box display="flex" justifyContent="space-between" gridGap="12px" marginTop="16px" flexWrap="wrap">
            <Metric
              label={
                <MetricLabel
                  label="Daily Premium"
                  tooltipTitle={`${Tooltips.StrategyEarnFunding}. ${Tooltips.CurrentImplFunding}`}
                />
              }
              gridGap="4px"
              value={
                currentImpliedFunding && currentImpliedFunding != Infinity
                  ? `${formatNumber(currentImpliedFunding * 100)}%`
                  : '-'
              }
            />
            <Metric
              label={<MetricLabel label="Implied Volatility " tooltipTitle={Tooltips.ImplVol} />}
              gridGap="4px"
              value={`${formatNumber(impliedVolShutdownPercent)}%`}
            />
            <Metric
              label={<MetricLabel label="Reference Volatility" tooltipTitle={Tooltips.osqthRefVol} />}
              gridGap="4px"
              value={`${formatNumber(osqthRefVol)}%`}
            />
          </Box>
        ) : (
          <div></div>
        )}
      </Fade>
    </div>
  )
}

export default AdvancedMetrics
