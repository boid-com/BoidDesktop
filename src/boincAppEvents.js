const nodeJSEvents = require('events')  //<--- Include the nodeJS module for events.

const boincAppEvents={
    eventEmitter: {}
}

boincAppEvents.eventEmitter = new nodeJSEvents.EventEmitter()

module.exports=boincAppEvents