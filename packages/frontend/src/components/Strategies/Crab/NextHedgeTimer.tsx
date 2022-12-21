import React, { useEffect, useState } from 'react'
import { Box, Typography } from '@material-ui/core'
import { makeStyles, createStyles } from '@material-ui/core/styles'
import { intervalToDuration, isBefore, nextDay as getNextDay } from 'date-fns'

const withHedgeTime = (date: Date): Date => {
  const timezoneDate = new Date(date).getDate()

  const withTime = new Date(date.setUTCDate(timezoneDate)).setUTCHours(16, 30, 0, 0)
  return new Date(withTime)
}

const getNextHedgeDay = (now: Date, day: Day): Date => {
  const nextDay = getNextDay(now, day)

  return nextDay
}

const getTodayInUTC = (date: Date): Date => {
  const todayInUTC = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    date.getUTCHours(),
    date.getUTCMinutes(),
    date.getUTCSeconds(),
  )

  return new Date(todayInUTC)
}

const getNextHedgeDate = (now: Date): Date => {
  // hedges every monday, wednesday, friday at 16:30 UTC

  // const nextMonday = getNextDayinUTC(now, 1)
  // const nextMondayHedgeDate = withHedgeTime(nextMonday)
  // console.log({ nextMonday, nextMondayHedgeDate })

  // compare in UTC terms
  const isMondayInUTC = now.getUTCDay() === 1
  const isWednesdayInUTC = now.getUTCDay() === 3
  const isFridayInUTC = now.getUTCDay() === 5
  const hasHedgeTimePassedInUTC = now.getUTCHours() > 16 || (now.getUTCHours() === 16 && now.getUTCMinutes() >= 30)

  // calculate next 3 hedge dates, could be today as well depending on time

  //get today in UTC
  const todayInUTC = getTodayInUTC(now)
  console.log({ todayInUTC })

  // give today's hedge date if it's not passed yet in utc

  // const nextMonday = isMonday && !hasHedgeTimePassed ? now : getNextDayinUTC(now, 1)
  // const nextWednesday = isWednesday && !hasHedgeTimePassed ? now : getNextDayinUTC(now, 3)
  // const nextFriday = isFriday && !hasHedgeTimePassed ? now : getNextDayinUTC(now, 5)

  // // set hedge time
  // const nextMondayHedgeDate = withHedgeTime(nextMonday)
  // const nextWednesdayHedgeDate = withHedgeTime(nextWednesday)
  // const nextFridayHedgeDate = withHedgeTime(nextFriday)

  // console.log({ now, nextMondayHedgeDate, nextWednesdayHedgeDate, nextFridayHedgeDate })

  // // find closest hedge date
  // const nextHedgeDate = [nextMondayHedgeDate, nextWednesdayHedgeDate, nextFridayHedgeDate].reduce((a, b) => {
  //   return isBefore(a, b) ? a : b
  // })
  // return nextHedgeDate
  return now
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
      const now = new Date(current.setHours(current.getHours() + 10))
      const nextHedgeDate = getNextHedgeDate(now)

      const duration = intervalToDuration({ start: now, end: nextHedgeDate })
      const formatted = `${duration.days}D ${duration.hours}H ${duration.minutes}M ${duration.seconds}S`
      setTimeLeft(formatted)
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
