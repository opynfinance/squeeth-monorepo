import { Typography } from '@material-ui/core'
import { createStyles, makeStyles } from '@material-ui/core/styles'
import React from 'react'

const useStyles = makeStyles((theme) =>
  createStyles({
    container: {
      padding: theme.spacing(2),
      background: '#F5692E1A',
      border: '1px solid #F5692E',
      borderRadius: theme.spacing(2),
      display: 'flex'
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
        <Typography variant="body1">Queue Migration to Crab V2</Typography>
        <Typography component="p" variant="caption" style={{ marginTop: '4px', lineHeight: 1.5 }} color="textSecondary">
          Crab v2 launches soon and crab v1 will be deprecated. Queue migration now to be included at launch.
        </Typography>
      </div>
    </div>
  )
}

export default MigrationNotice
