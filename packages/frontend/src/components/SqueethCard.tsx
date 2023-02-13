import { Box, BoxProps, useTheme } from '@material-ui/core'
import { FC } from 'react'

const SqueethCard: FC<BoxProps> = ({ children, ...props }) => {
  const theme = useTheme()
  return (
    <Box p={2} bgcolor={theme.palette.background.stone} borderRadius={theme.spacing(1)} display="flex" {...props}>
      {children}
    </Box>
  )
}

export default SqueethCard
