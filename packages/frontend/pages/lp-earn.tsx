import ActionButton from '@components/ActionButton'
import CurrencyInput from '@components/CurrencyInput'
import Nav from '@components/Nav'
import Text from '@components/Text'
import { Box, Container } from '@material-ui/core'

export default function LpLearn() {
  return (
    <div>
      <Nav />
      <Box borderColor="#18F5D7" borderTop={1} borderBottom={1} py={7}>
        <Container>
          <Box fontSize={32} fontWeight={700} color="white">
            Deposit ERC-20s, earn ETH.
          </Box>
          <Box mt="6px" fontSize={18}>
            Provide liquidity to earn interest through fees and funding.
          </Box>
        </Container>
      </Box>
      <Box py={9}>
        <Container>
          <Box display="flex">
            <Box flex={2}></Box>
            <Box ml={15} flex={1}>
              <Text variant="H3">Deposit tokens</Text>
              <CurrencyInput currency="ETH" mt={3} />
              <CurrencyInput currency="oSQTH" mt={2} />
              <ActionButton mt="20px">Preview deposit</ActionButton>
            </Box>
          </Box>
        </Container>
      </Box>
    </div>
  )
}
