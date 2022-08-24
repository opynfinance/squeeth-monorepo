import { BG_DARK, BUTTON_BLUE } from '@constants/theme'
import { Box, BoxProps } from '@material-ui/core'
import Text from './Text'

interface Props extends BoxProps {}

export default function ActionButton({ children, ...props }: Props) {
  return (
    <Box
      role="button"
      py="18px"
      borderRadius={14}
      textAlign="center"
      bgcolor={BUTTON_BLUE}
      style={{ cursor: 'pointer' }}
      {...props}
    >
      <Text variant="H4" color={BG_DARK}>
        {children}
      </Text>
    </Box>
  )
}
