import { Typography } from '@material-ui/core'
import { createStyles, makeStyles } from '@material-ui/core/styles'
import clsx from 'clsx'
import React from 'react'

const useStyles = makeStyles((theme) =>
  createStyles({
    container: {
      padding: theme.spacing(2),
      border: '1px solid rgba(19, 131, 17)',
      borderRadius: theme.spacing(2),
      display: 'flex',
    },
  }),
)

const MigrationNotice: React.FC = () => {
  const classes = useStyles()

  return (
    <div className={clsx(classes.container, 'crab-notice')}>
      <div>
        <Typography variant="h6">🦀</Typography>
      </div>
      <div style={{ marginLeft: '8px' }}>
        <Typography variant="body1">Crab V2 Early Access: guarantee your spot </Typography>
        <Typography component="p" variant="caption" style={{ marginTop: '4px', lineHeight: 1.5 }} color="textSecondary">
          As OG crabbers, you get to be included v2 before anyone else. Guarantee your spot in Crab v2 right when it
          drops!
        </Typography>
      </div>
    </div>
  )
}

export default MigrationNotice
