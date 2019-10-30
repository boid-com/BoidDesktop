const ipc = require('./ipcWrapper')()             //<--- Require-in the ipc wrapper for send the events to the site.
const electron = require('electron')              //<--- Require the electron module. Used for the 'powerMonitor' sub-module.
const boinc = require('./boinc')                  //<--- Require the boinc object in order to gain access to the global application state.
const boidAppEvents = require('./boidAppEvents')  //<--- Our In-House nodeJS module for events sub/sink.
const gpu = require('./gpu')                      //<--- Require the boinc object in order to gain access to the global application state.

var globalPowerEvents={
    powerMonitor: {},
    intervalTimer=5000
}

globalPowerEvents.init = () => {
    globalPowerEvents.powerMonitor=electron.powerMonitor

  //Send the on-batteries event to the site to handle any BOINC client suspension.....
  globalPowerEvents.powerMonitor.on('on-battery', async () => {
    //var tmpConfigObj=await config.get()
    var tmpCPUBoincObj=await boinc.config.read()
    var tmpGPUBoincObj=await gpu.config.read()

    if(!tmpCPUBoincObj.run_on_batteries){
      boidAppEvents.emit('boinc.suspend')
      ipc.send('log', "Suspending computation - on batteries")
    }

    if(!tmpGPUBoincObj.run_on_batteries){
      boidAppEvents.emit('gpu.suspend')
      ipc.send('log', "Suspending computation - on batteries")
    }
  })

  powerMonitor.on('on-ac', async () => {
    //var tmpConfigObj=await config.get()
    var tmpCPUBoincObj=await boinc.config.read()
    var tmpGPUBoincObj=await gpu.config.read()

    if(!tmpCPUBoincObj.run_on_batteries){
      boidAppEvents.emit('boinc.resume')
      ipc.send('log', "Resuming computation")
    }

    if(!tmpGPUBoincObj.run_on_batteries){
      boidAppEvents.emit('gpu.resume')
      ipc.send('log', "Resuming computation")
    }
})

  setTimeout(_timeoutCPUFunction, globalPowerEvents.intervalTimer)
  setTimeout(_timeoutGPUFunction, globalPowerEvents.intervalTimer)
}

//Send the on-use event to the site to handle any BOINC client suspension.....
function _timeoutCPUFunction(){
    powerMonitor.querySystemIdleTime(async function(idleTime){
      var tmpConfigObj=await config.get()
      var tmpCPUBoincObj=await boinc.config.read()

      if(tmpConfigObj.state.cpu.toggle && !tmpCPUBoincObj.run_if_user_active) {
        if(idleTime===0){
          await ipc.send('log', "Suspending computation - computer is in use")
          await boidAppEvents.emit('boinc.suspend')

          globalPowerEvents.intervalTimer=parseInt(tmpCPUBoincObj.idle_time_to_run, 10) * 60000
          setTimeout(_timeoutCPUFunction, globalPowerEvents.intervalTimer)
        }else{
          await ipc.send('log', "Resuming computation")
          await boidAppEvents.emit('boinc.resume')

          globalPowerEvents.intervalTimer=5000
          setTimeout(_timeoutCPUFunction, globalPowerEvents.intervalTimer)
        }
      }else{
        setTimeout(_timeoutCPUFunction, globalPowerEvents.intervalTimer)
      }
    })
}

//Send the on-use event to the site to handle any GPU client suspension.....
function _timeoutGPUFunction(){
    powerMonitor.querySystemIdleTime(async function(idleTime){
      var tmpConfigObj=await config.get()
      var tmpGPUBoincObj=await gpu.config.read()
  
      if(tmpConfigObj.state.gpu.toggle && !tmpGPUBoincObj.run_if_user_active) {
        if(idleTime===0){
          await ipc.send('log', "Suspending computation - computer is in use")
          await boidAppEvents.emit('gpu.suspend')
  
          globalPowerEvents.intervalTimer=parseInt(tmpGPUBoincObj.idle_time_to_run, 10) * 60000
          setTimeout(_timeoutGPUFunction, globalPowerEvents.intervalTimer)
        }else{
          await ipc.send('log', "Resuming computation")
          await boidAppEvents.emit('gpu.resume')
  
          globalPowerEvents.intervalTimer=5000
          setTimeout(_timeoutGPUFunction, globalPowerEvents.intervalTimer)
        }
      }else{
        setTimeout(_timeoutGPUFunction, globalPowerEvents.intervalTimer)
      }
    })
}