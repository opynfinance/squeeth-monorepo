import React from 'react'
import { Typography } from '@material-ui/core'

const Loading: React.FC<{ isSmall?: boolean }> = ({ isSmall = false }) => {
  return <Typography variant={isSmall ? 'caption' : 'body1'}>loading...</Typography>
}

export default Loading
