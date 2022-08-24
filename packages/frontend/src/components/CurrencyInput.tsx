import { BG_3, BG_DARK, BG_SURFACE } from '@constants/theme'
import { Box, BoxProps, InputBase } from '@material-ui/core'
import Text from './Text'

interface Props extends BoxProps {
  currency: 'ETH' | 'oSQTH'
}

export default function CurrencyInput({ currency, ...props }: Props) {
  return (
    <Box borderRadius={12} bgcolor={BG_SURFACE} {...props}>
      <Box
        borderColor={BG_3}
        border={2}
        borderRadius={12}
        p={2.5}
        bgcolor={BG_DARK}
        display="flex"
        alignItems="flex-start"
      >
        <Box flex={1}>
          <InputBase
            defaultValue="0"
            style={{ fontSize: 24, fontWeight: 700, color: 'rgba(255, 255, 255, 0.3)', width: '100%' }}
          />
          <Box style={{ opacity: 0.6 }} fontSize={16}>
            $0
          </Box>
        </Box>
        <Box bgcolor={BG_SURFACE} py={0.75} px={1.5} borderRadius={7} display="flex" alignItems="center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/images/${currency.toLowerCase()}.svg`} alt="" />
          <Text variant="H4" style={{ opacity: 0.5 }} ml="10px">
            {currency}
          </Text>
        </Box>
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
