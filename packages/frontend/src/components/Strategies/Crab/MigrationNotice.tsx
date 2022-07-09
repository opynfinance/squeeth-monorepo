import { Typography } from '@material-ui/core'
import { createStyles, makeStyles } from '@material-ui/core/styles'
import React from 'react'

const useStyles = makeStyles((theme) =>
  createStyles({
    container: {
      padding: theme.spacing(2),
      background:
        'linear-gradient(90deg, rgba(238,94,63,0.39821866246498594) 0%, rgba(255,186,236,0.4598433123249299) 35%, rgba(255,159,105,0.4402354691876751) 100%);',
      border: '1px solid #ee5e3f',
      borderRadius: theme.spacing(2),
      display: 'flex',
    },
  }),
)

const MigrationNotice: React.FC = () => {
  const classes = useStyles()

  return (
    <div className={classes.container}>
      <div>
        <Typography variant="h6">🦀</Typography>
      </div>
      <div style={{ marginLeft: '8px' }}>
        <Typography variant="body1">Crab V2 Early Access: Gaurantee your spot </Typography>
        <Typography component="p" variant="caption" style={{ marginTop: '4px', lineHeight: 1.5 }} color="textSecondary">
          As OG Day 1 crabbers, you get to commit to v2 before anyone else. Gaurantee your spot in crab v2 right when
          drops!
        </Typography>
      </div>
    </div>
  )
}

export default MigrationNotice
