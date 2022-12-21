import React, { useEffect, useState } from 'react'
import { Typography } from '@material-ui/core'
import { makeStyles, createStyles } from '@material-ui/core/styles'
import { intervalToDuration } from 'date-fns'
import { sortBy } from 'lodash'

const getNextHedgeDate = (now: Date): Date => {
  // hedges every monday, wednesday, friday at 16:30 UTC

  // next monday at 16:30 UTC
  const nextMondayHedge = new Date(now)
  nextMondayHedge.setUTCDate(nextMondayHedge.getUTCDate() + ((1 + 7 - nextMondayHedge.getUTCDay()) % 7 || 7))
  nextMondayHedge.setUTCHours(16, 30, 0, 0)

  // next wednesday at 16:30 UTC
  const nextWednesdayHedge = new Date(now)
  nextWednesdayHedge.setUTCDate(nextWednesdayHedge.getUTCDate() + ((3 + 7 - nextWednesdayHedge.getUTCDay()) % 7 || 7))
  nextWednesdayHedge.setUTCHours(16, 30, 0, 0)

  // next wednesday at 16:30 UTC
  const nextFridayHedge = new Date(now)
  nextFridayHedge.setUTCDate(nextFridayHedge.getUTCDate() + ((5 + 7 - nextFridayHedge.getUTCDay()) % 7 || 7))
  nextFridayHedge.setUTCHours(16, 30, 0, 0)

  // today at 16:30 UTC
  const todayHedge = new Date(now)
  todayHedge.setUTCDate(todayHedge.getUTCDate())
  todayHedge.setUTCHours(16, 30, 0, 0)

  const isMondayInUTC = now.getUTCDay() === 1
  const isWednesdayInUTC = now.getUTCDay() === 3
  const isFridayInUTC = now.getUTCDay() === 5
  const hasHedgeTimePassedInUTC = now.getUTCHours() > 16 || (now.getUTCHours() === 16 && now.getUTCMinutes() >= 30)

  // if today is monday, wednesday, friday and time is before 16:30 UTC, use today's hedge date
  const comingMondayHedge = isMondayInUTC && !hasHedgeTimePassedInUTC ? todayHedge : nextMondayHedge
  const comingWednesdayHedge = isWednesdayInUTC && !hasHedgeTimePassedInUTC ? todayHedge : nextWednesdayHedge
  const comingFridayHedge = isFridayInUTC && !hasHedgeTimePassedInUTC ? todayHedge : nextFridayHedge

  // find closest hedge date
  const nextHedges = sortBy([comingMondayHedge, comingWednesdayHedge, comingFridayHedge], (date) => date.getTime())
  return nextHedges[0]
}

const useStyles = makeStyles(() =>
  createStyles({
    label: {
      fontSize: '15px',
      color: 'rgba(255, 255, 255, 0.5)',
      fontWeight: 500,
    },
    value: {
      fontSize: '20px',
      color: 'rgba(255, 255, 255, 1)',
      fontWeight: 500,
      fontFamily: 'DM Mono',
    },
  }),
)

const NextHedgeTimer: React.FC = () => {
  const [timeLeft, setTimeLeft] = useState('')
  const classes = useStyles()

  useEffect(() => {
    const interval = setInterval(() => {
      const current = new Date()
      const now = new Date(current.setHours(current.getHours() + 8))
      const nextHedgeDate = getNextHedgeDate(now)

      const duration = intervalToDuration({ start: now, end: nextHedgeDate })
      const result = `${duration.days}D ${duration.hours}H ${duration.minutes}M ${duration.seconds}S`
      setTimeLeft(result)
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  return (
    <>
      <Typography className={classes.label}>Next hedge in</Typography>
      <Typography className={classes.value} variant="subtitle2">
        {timeLeft}
      </Typography>
    </>
  )
}

export default NextHedgeTimer
