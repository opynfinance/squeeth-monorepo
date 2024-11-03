import { ApolloClient, InMemoryCache, split, HttpLink, ApolloLink, from } from '@apollo/client'
import { getMainDefinition } from '@apollo/client/utilities'
import { WebSocketLink } from '@apollo/client/link/ws'
import { SITE_EVENTS, trackEvent } from './amplitude'
import * as Fathom from 'fathom-client'

const THE_GRAPH_API_KEYS = {
  SQUEETH: process.env.NEXT_PUBLIC_THE_GRAPH_SQUEETH_SUBGRAPH_API_KEY,
  UNISWAP: process.env.NEXT_PUBLIC_THE_GRAPH_UNISWAP_SUBGRAPH_API_KEY,
}

const SUBGRAPH_IDS = {
  UNISWAP_V3: '5zvR82QoaXYFyDEKLZ9t6v9adgnptxYpKpSbxtgVENFV',
  SQUEETH: '9VC95zuTxcMhXxU25qQkEK2akFzE3eEPiBZGXjGbGcbA',
}

const httpLinkMN = new HttpLink({
  uri: `https://gateway-arbitrum.network.thegraph.com/api/${THE_GRAPH_API_KEYS.UNISWAP}/subgraphs/id/${SUBGRAPH_IDS.UNISWAP_V3}`,
})

const httpLinkRP = new HttpLink({
  uri: 'https://api.thegraph.com/subgraphs/name/kmkoushik/uniswap-v3-ropsten',
})

const httpLinkGL = new HttpLink({
  uri: 'https://api.thegraph.com/subgraphs/name/kmkoushik/uniswap-v3-goerli',
})

const httpLinkRPSqueeth = new HttpLink({
  uri: 'https://api.thegraph.com/subgraphs/name/opynfinance/squeeth-ropsten',
})

const httpLinkMNSqueeth = new HttpLink({
  uri: `https://gateway-arbitrum.network.thegraph.com/api/${THE_GRAPH_API_KEYS.SQUEETH}/subgraphs/id/${SUBGRAPH_IDS.SQUEETH}`,
  fetch: async (...pl) => {
    const [_, options] = pl
    if (options?.body) {
      const body = JSON.parse(options.body.toString())
      const startTime = new Date().getTime()
      const res = await fetch(...pl)
      const elapsed = new Date().getTime() - startTime
      trackEvent(SITE_EVENTS.SUBGRAPH_QUERY_LOADED, { query: body.operationName, time: elapsed })
      Fathom.trackGoal('HPHEK6AI', elapsed) //Track in fathom
      return res
    }

    return fetch(...pl)
  },
})

const httpLinkGLSqueeth = new HttpLink({
  uri: 'https://api.thegraph.com/subgraphs/name/haythem96/squeeth-temp-subgraph',
})

const wsLinkRP =
  typeof window !== 'undefined'
    ? new WebSocketLink({
        uri: 'wss://api.thegraph.com/subgraphs/name/kmkoushik/uniswap-v3-ropsten',
        options: {
          reconnect: false,
        },
      })
    : null

const wsLinkMN =
  typeof window !== 'undefined'
    ? new WebSocketLink({
        uri: 'wss://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3',
        options: {
          reconnect: false,
        },
      })
    : null

const wsLinkGL =
  typeof window !== 'undefined'
    ? new WebSocketLink({
        uri: 'wss://api.thegraph.com/subgraphs/name/kmkoushik/uniswap-v3-goerli',
        options: {
          reconnect: false,
        },
      })
    : null

const wsLinkRPSqueeth =
  typeof window !== 'undefined'
    ? new WebSocketLink({
        uri: 'wss://api.thegraph.com/subgraphs/name/opynfinance/squeeth-ropsten',
        options: {
          reconnect: false,
        },
      })
    : null

const wsLinkMNSqueeth =
  typeof window !== 'undefined'
    ? new WebSocketLink({
        uri: 'wss://api.thegraph.com/subgraphs/name/opynfinance/squeeth',
        options: {
          reconnect: false,
        },
      })
    : null

const wsLinkGLSqueeth =
  typeof window !== 'undefined'
    ? new WebSocketLink({
        uri: 'wss://api.thegraph.com/subgraphs/name/haythem96/squeeth-temp-subgraph',
        options: {
          reconnect: false,
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

const goerli = new ApolloClient({
  link: typeof window !== 'undefined' ? splitLink(wsLinkGL, httpLinkGL) : undefined,
  cache: new InMemoryCache(),
})

const sepolia = new ApolloClient({
  link: typeof window !== 'undefined' ? splitLink(wsLinkGL, httpLinkGL) : undefined,
  cache: new InMemoryCache(),
})

export const uniswapClient = {
  1: mainnet,
  3: ropsten,
  5: goerli,
  11155111: sepolia,
  31337: mainnet, // Can be replaced with local graph node if needed
  421611: mainnet, // Should be replaced with arbitrum subgraph
}

const squeethMainnet = new ApolloClient({
  link: typeof window !== 'undefined' ? ApolloLink.from([splitLink(wsLinkMNSqueeth, httpLinkMNSqueeth)]) : undefined,
  cache: new InMemoryCache(),
})

const squeethRopsten = new ApolloClient({
  link: typeof window !== 'undefined' ? splitLink(wsLinkRPSqueeth, httpLinkRPSqueeth) : undefined,
  cache: new InMemoryCache(),
})

const squeethGoerli = new ApolloClient({
  link: typeof window !== 'undefined' ? splitLink(wsLinkGLSqueeth, httpLinkGLSqueeth) : undefined,
  cache: new InMemoryCache(),
})

const squeethSepolia = new ApolloClient({
  link: typeof window !== 'undefined' ? splitLink(wsLinkGLSqueeth, httpLinkGLSqueeth) : undefined,
  cache: new InMemoryCache(),
})

export const squeethClient = {
  1: squeethMainnet,
  3: squeethRopsten,
  5: squeethGoerli,
  11155111: squeethSepolia,
  31337: squeethMainnet, // Can be replaced with local graph node if needed
  421611: squeethMainnet, // Should be replaced with arbitrum subgraph
}
