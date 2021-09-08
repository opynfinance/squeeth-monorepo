import { ApolloClient, InMemoryCache } from '@apollo/client'

const mainnet = new ApolloClient({
  uri: 'https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3',
  cache: new InMemoryCache(),
})

const ropsten = new ApolloClient({
  uri: 'https://api.thegraph.com/subgraphs/name/kmkoushik/uniswap-v3-ropsten',
  cache: new InMemoryCache(),
})

export const uniswapClient = {
  1: mainnet,
  3: ropsten,
  31337: mainnet, // Can be replaced with local graph node if needed
  421611: mainnet, // Should be replaced with arbitrum subgraph
}
