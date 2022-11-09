import { setOptOut } from '@amplitude/analytics-browser'
import { PrimaryButton } from '@components/Button'
import { MintSqueeth } from '@components/Lp/GetSqueeth'
import Nav from '@components/Nav'
import { Box, Typography } from '@material-ui/core'
import { createStyles, makeStyles } from '@material-ui/core/styles'
import { isOptedOut } from '@utils/amplitude'
import Link from 'next/link'
import React, { useEffect, useState } from 'react'

const useStyles = makeStyles((theme) =>
  createStyles({
    container: {
      padding: theme.spacing(2),
    },
    title: {
      marginTop: theme.spacing(10),
    },
    getSqueethCard: {
      width: '300px',
      overflow: 'auto',
      margin: 'auto',
      marginTop: theme.spacing(4),
      padding: theme.spacing(2, 0),
    },
  }),
)

const MintPage: React.FC = () => {
  const classes = useStyles()
  const [optOut, setOpt] = useState(false)

  useEffect(() => {
    isOptedOut().then(setOpt)
  }, [])

  const toggleOptOut = () => {
    setOptOut(!optOut)
    setOpt(!optOut)
  }

  return (
    <div>
      <Nav />
      <Typography align="center" variant="h6" className={classes.title}>
        {optOut ? 'You opted out from Amplitude tracking' : 'Opt out from Amplitude tracking'}
      </Typography>
      <Box className={classes.getSqueethCard}>
        <PrimaryButton onClick={toggleOptOut}>{optOut ? 'Opt In' : 'Opt out'}</PrimaryButton>
      </Box>
    </div>
  )
}

export default MintPage
