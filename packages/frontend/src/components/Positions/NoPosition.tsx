import React from 'react'
import { Typography } from '@material-ui/core'
import Link from 'next/link'

import useStyles from './useStyles'

interface NoPositionProps {
  noPositionText: string
  ctaText: string
  ctaLink: string
}

const NoPosition: React.FC<NoPositionProps> = ({ noPositionText, ctaText, ctaLink }) => {
  const classes = useStyles()

  return (
    <div className={classes.noPositionContainer}>
      <Typography variant="body1" color="textSecondary">
        {noPositionText}&nbsp;
      </Typography>

      <div>
        <Typography variant="body1" color="primary" component="span">
          <Link href={ctaLink}>Click here</Link>
        </Typography>
        <Typography variant="body1" color="textSecondary" component="span">
          &nbsp;to {ctaText}
        </Typography>
      </div>
    </div>
  )
}

export default NoPosition
