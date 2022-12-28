import React from 'react'
import { Typography, TypographyProps } from '@material-ui/core'

const Emoji: React.FC<TypographyProps> = (props) => {
  return <Typography component="span" role="img" {...props} />
}

export default Emoji
