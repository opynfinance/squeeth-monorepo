import React from 'react'
import { Box, Typography, BoxProps } from '@material-ui/core'
import { makeStyles, createStyles } from '@material-ui/core/styles'
import InfoIcon from '@material-ui/icons/Info'
import clsx from 'clsx'

import { useTypographyStyles } from './styles'

const useStyles = makeStyles((theme) =>
  createStyles({
    root: {
      backgroundColor: theme.palette.warning.light,
      border: '1px solid',
      borderColor: theme.palette.warning.main,
      borderRadius: '14px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: '20px',
      padding: '24px',
    },
  }),
)

export const Warning: React.FC<BoxProps> = ({ children, ...props }) => {
  const classes = useStyles()
  const typographyClasses = useTypographyStyles()

  return (
    <Box className={classes.root} {...props}>
      <InfoIcon />
      <Typography className={clsx(typographyClasses.mediumBold, typographyClasses.smallFont)}>{children}</Typography>
    </Box>
  )
}
