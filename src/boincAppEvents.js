const events = require('events')  //<--- Include the nodeJS module for events.

const boincAppEvents={
    eventEmitter: {},
    eventsRegistered: []
}

boincAppEvents.init = () => {
    boincAppEvents.eventEmitter = new events.EventEmitter()
}

boincAppEvents.isEventRegistered = async (eventName) => {
    let findVal=boincAppEvents.eventsRegistered.find(function(item){
        return item['eventName']===eventName
    })

    return (findVal!==null && findVal!==undefined)
}

boincAppEvents.registerEvent = async (eventName, eventMethod) => {
    let findVal=await boincAppEvents.isEventRegistered(eventName)

    if(findVal){
        console.log('Event with name: ['+eventName+'] has already been registered!')
    }else{
        boincAppEvents.eventEmitter.addListener(eventName, eventMethod)
        boincAppEvents.eventsRegistered.push({'eventName': eventName, 'eventMethod': eventMethod})
    }
}

boincAppEvents.deRegisterEvent = async (eventName) => {
    let findVal=await boincAppEvents.isEventRegistered(eventName)

    if(findVal){
        console.log('Event with name: ['+eventName+'] has already been registered!')
    }else{
        boincAppEvents.eventEmitter.removeListener(eventName, eventMethod)
        for(let i=0; i<boincAppEvents.eventsRegistered.length; i++){
            if(boincAppEvents.eventsRegistered['eventName']===eventName){
                boincAppEvents.eventsRegistered.splice(i, 1)
                break
            }
        }
    }
}

boincAppEvents.emit = async (eventName) => {
    let findVal=await boincAppEvents.isEventRegistered(eventName)

    if(!findVal){
        console.log('Event with name: ['+eventName+'] has not been registered!')
    }else{
        boincAppEvents.eventEmitter.emit(eventName)
    }
}

boincAppEvents.init()   //<--- Module initialization method. Always make these non-async.

module.exports=boincAppEvents