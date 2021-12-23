import { ApolloClient, InMemoryCache, split, HttpLink } from '@apollo/client'
import { getMainDefinition } from '@apollo/client/utilities'
import { WebSocketLink } from '@apollo/client/link/ws'

const httpLinkMN = new HttpLink({
  uri: 'https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3',
})

const httpLinkRP = new HttpLink({
  uri: 'https://api.thegraph.com/subgraphs/name/kmkoushik/uniswap-v3-ropsten',
})

const wsLinkRP =
  typeof window !== 'undefined'
    ? new WebSocketLink({
        uri: 'wss://api.thegraph.com/subgraphs/name/kmkoushik/uniswap-v3-ropsten',
        options: {
          reconnect: true,
        },
      })
    : null

const wsLinkMN =
  typeof window !== 'undefined'
    ? new WebSocketLink({
        uri: 'wss://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3',
        options: {
          reconnect: true,
        },
      })
    : null

const splitLink = (wsLink: any, httpLink: any) => {
  return split(
    ({ query }) => {
      const definition = getMainDefinition(query)
      return definition.kind === 'OperationDefinition' && definition.operation === 'subscription'
    },
    wsLink,
    httpLink,
  )
}

const mainnet = new ApolloClient({
  link: typeof window !== 'undefined' ? splitLink(wsLinkMN, httpLinkMN) : undefined,
  cache: new InMemoryCache(),
})

const ropsten = new ApolloClient({
  link: typeof window !== 'undefined' ? splitLink(wsLinkRP, httpLinkRP) : undefined,
  cache: new InMemoryCache(),
})

export const uniswapClient = {
  1: mainnet,
  3: ropsten,
  31337: mainnet, // Can be replaced with local graph node if needed
  421611: mainnet, // Should be replaced with arbitrum subgraph
}

export const squeethClient = new ApolloClient({
  uri: process.env.NEXT_PUBLIC_SUBGRAPH_URI,
  cache: new InMemoryCache(),
})
