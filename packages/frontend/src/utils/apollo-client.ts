import { ApolloClient, InMemoryCache, split, HttpLink } from '@apollo/client'
import { getMainDefinition } from '@apollo/client/utilities'
import { WebSocketLink } from '@apollo/client/link/ws'

const httpLinkMN = new HttpLink({
  uri: 'https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3',
})

const httpLinkRP = new HttpLink({
  uri: 'https://api.thegraph.com/subgraphs/name/kmkoushik/uniswap-v3-ropsten',
})

const httpLinkRPSqueeth = new HttpLink({
  uri: 'https://api.thegraph.com/subgraphs/name/adam5909099/squeeth-first',
})

const httpLinkMNSqueeth = new HttpLink({
  uri: 'https://api.thegraph.com/subgraphs/name/yichiehliu/squeeth_mainnet',
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

const wsLinkRPSqueeth =
  typeof window !== 'undefined'
    ? new WebSocketLink({
        uri: 'wss://api.thegraph.com/subgraphs/name/adam5909099/squeeth-first',
        options: {
          reconnect: true,
        },
      })
    : null

const wsLinkMNSqueeth =
  typeof window !== 'undefined'
    ? new WebSocketLink({
        uri: 'wss://api.thegraph.com/subgraphs/name/yichiehliu/squeeth_mainnet',
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

const squeethMainnet = new ApolloClient({
  link: typeof window !== 'undefined' ? splitLink(wsLinkMNSqueeth, httpLinkMNSqueeth) : undefined,
  cache: new InMemoryCache(),
})

const squeethRopsten = new ApolloClient({
  link: typeof window !== 'undefined' ? splitLink(wsLinkRPSqueeth, httpLinkRPSqueeth) : undefined,
  cache: new InMemoryCache(),
})

export const squeethClient = {
  1: squeethMainnet,
  3: squeethRopsten,
  31337: squeethMainnet, // Can be replaced with local graph node if needed
  421611: squeethMainnet, // Should be replaced with arbitrum subgraph
}
