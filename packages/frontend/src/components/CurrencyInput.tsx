import { BG_3, BG_DARK, BG_SURFACE } from '@constants/theme'
import { Box, InputBase } from '@material-ui/core'
import Text from './Text'

export default function CurrencyInput() {
  return (
    <Box borderRadius={12} bgcolor={BG_SURFACE}>
      <Box borderColor={BG_3} border={2} borderRadius={12} p={2.5} bgcolor={BG_DARK}>
        <InputBase
          defaultValue="0"
          style={{ fontSize: 24, fontWeight: 700, color: 'rgba(255, 255, 255, 0.3)', flex: 1 }}
        />
      </Box>
      <Box px={3} py={2} display="flex" justifyContent="space-between">
        <Text variant="LabelL" color="white" style={{ opacity: 0.5 }}>
          Available
        </Text>
        <Text variant="LabelL">125.56 ETH</Text>
      </Box>
    </Box>
  )
}
