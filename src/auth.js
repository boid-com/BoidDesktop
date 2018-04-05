var config = null
const EventEmitter = require('events')
// var api = require('./api.js')
var events = new EventEmitter()

var auth = {
  events,
  init: async () => {
    config = require('electron-settings')
    var token = config.get('token')
    if (token) {
      console.log('found Token', token)

      // api.setupClient(token)
      auth.events.emit('requestLogin')
    } else auth.events.emit('requestLogin')
  },
  parseUserData: async (event, user) => {
    // console.log('received user data', user)
  },
  saveToken: async (even, token) => {
    // console.log('received Token Data in Auth', token)
    // config.set('token', token.token)
    // config.set('id', token.id)
  },
  returnToken() {
    console.log('got return token request')
    return config.get('token')
  }
}

module.exports = auth
