import CurrencyInput from '@components/CurrencyInput'
import Nav from '@components/Nav'
import Text from '@components/Text'
import { Box, Container } from '@material-ui/core'

export default function LpLearn() {
  return (
    <div>
      <Nav />
      <Box py={9}>
        <Container>
          <Box display="flex">
            <Box flex={2}>Test</Box>
            <Box ml={15} flex={1}>
              <Text variant="H3">Deposit tokens</Text>
              <Box mt={3}>
                <CurrencyInput />
              </Box>
            </Box>
          </Box>
        </Container>
      </Box>
    </div>
  )
}
