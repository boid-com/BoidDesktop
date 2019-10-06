const events = require('events')  //<--- Include the nodeJS module for events.

const boidAppEvents={
    eventEmitter: {},
    eventsRegistered: []
}

boidAppEvents.init = () => {
    boidAppEvents.eventEmitter = new events.EventEmitter()
}

boidAppEvents.isEventRegistered = async (eventName) => {
    let findVal=boidAppEvents.eventsRegistered.find(function(item){
        return item['eventName']===eventName
    })

    return (findVal!==null && findVal!==undefined)
}

boidAppEvents.registerEvent = async (eventName, eventMethod) => {
    let findVal=await boidAppEvents.isEventRegistered(eventName)

    if(findVal){
        console.log('Event with name: ['+eventName+'] has already been registered!')
    }else{
        boidAppEvents.eventEmitter.addListener(eventName, eventMethod)
        boidAppEvents.eventsRegistered.push({'eventName': eventName, 'eventMethod': eventMethod})
    }
}

boidAppEvents.deRegisterEvent = async (eventName) => {
    let findVal=await boidAppEvents.isEventRegistered(eventName)

    if(!findVal){
        console.log('Event with name: ['+eventName+'] has not been registered!')
    }else{
        boidAppEvents.eventEmitter.removeListener(eventName, eventMethod)
        for(let i=0; i<boidAppEvents.eventsRegistered.length; i++){
            if(boidAppEvents.eventsRegistered['eventName']===eventName){
                boidAppEvents.eventsRegistered.splice(i, 1)
                break
            }
        }
    }
}

boidAppEvents.emit = async (eventName) => {
    let findVal=await boidAppEvents.isEventRegistered(eventName)

    if(!findVal){
        console.log('Event with name: ['+eventName+'] has not been registered!')
    }else{
        boidAppEvents.eventEmitter.emit(eventName)
    }
}

boidAppEvents.init()   //<--- Module initialization method. Always make these non-async.

module.exports=boidAppEvents