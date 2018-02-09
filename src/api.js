import { GraphQLClient } from 'graphql-request'
import EventEmitter from 'events'
import m from './gql/mutations.js'
import q from './gql/queries.js'

var events = new EventEmitter()

var gqlEndpoint = 'https://api.graph.cool/simple/v1/boid'
var client = null

function setupClient(token) {
  if (token) {
    client = new GraphQLClient(gqlEndpoint, {
      headers: {
        Authorization: 'Bearer ' + token
      }
    })
  } else {
    client = new GraphQLClient(gqlEndpoint)
  }
}
setupClient()

var api = {
  events,
  setupClient,
  device: {
    check: async (device) => {
      var result = await client.request(q.device.check(), device)
    }
  }
}

export default api
