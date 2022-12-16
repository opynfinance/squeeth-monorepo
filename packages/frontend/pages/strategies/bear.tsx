import React from 'react'
import Image from 'next/image'
import { Typography } from '@material-ui/core'
import { createStyles, makeStyles } from '@material-ui/core/styles'

import bear from 'public/images/bear.gif'

const useStyles = makeStyles((theme) =>
  createStyles({
    comingSoon: {
      height: '50vh',
      display: 'flex',
      alignItems: 'center',
      marginTop: theme.spacing(4),
    },
  }),
)

const BearStrategy: React.FC = () => {
  const classes = useStyles()

  return (
    <div className={classes.comingSoon}>
      <Image src={bear} alt="squeeth token" width={200} height={130} />
      <Typography variant="h6" style={{ marginLeft: '8px' }} color="primary">
        Coming soon
      </Typography>
    </div>
  )
}

const Page: React.FC = () => <BearStrategy />

export default Page
