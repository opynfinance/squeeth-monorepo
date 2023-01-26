import React, { useEffect, useState } from 'react'
import { Typography } from '@material-ui/core'
import { makeStyles, createStyles } from '@material-ui/core/styles'
import { intervalToDuration } from 'date-fns'
import { getNextHedgeDate } from '@state/crab/utils'

const padZero = (number: number, padding: number): String => {
  return `${number}`.padStart(padding, '0')
}

const useStyles = makeStyles(() =>
  createStyles({
    label: {
      fontSize: '15px',
      color: 'rgba(255, 255, 255, 0.5)',
      fontWeight: 500,
      textAlign: 'right',
    },
    value: {
      fontSize: '15px',
      color: 'rgba(255, 255, 255, 1)',
      fontWeight: 500,
      fontFamily: 'DM Mono',
      textAlign: 'right',
    },
  }),
)

const NextRebalanceTimer: React.FC = () => {
  const [timeLeft, setTimeLeft] = useState('')
  const classes = useStyles()

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date()
      const nextHedgeDate = getNextHedgeDate(now)

      const duration = intervalToDuration({ start: now, end: nextHedgeDate })
      const days = padZero(duration.days ?? 0, 2)
      const hours = padZero(duration.hours ?? 0, 2)
      const minutes = padZero(duration.minutes ?? 0, 2)
      const seconds = padZero(duration.seconds ?? 0, 2)

      const result = `${days}D ${hours}H ${minutes}M ${seconds}S`
      setTimeLeft(result)
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  return (
    <div style={{ marginTop: '16px' }}>
      <Typography className={classes.label}>Next hedge in</Typography>
      <Typography className={classes.value} variant="subtitle2">
        {timeLeft}
      </Typography>
    </div>
  )
}

export default NextRebalanceTimer
