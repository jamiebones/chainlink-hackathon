// lib/apolloClient.ts
import { ApolloClient, InMemoryCache } from '@apollo/client'

const client = new ApolloClient({
  uri: 'https://api.studio.thegraph.com/query/9399/vault/version/latest', // replace with actual URL
  cache: new InMemoryCache(),
})

export default client
