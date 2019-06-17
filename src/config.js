const duid = require("machine-uuid")
const cfg = require( 'electron-settings' )
const {ipcMain,app,powerSaveBlocker} = require('electron')
const isDev = require( 'electron-is-dev' )
const ipc = require('./ipcWrapper')()
const boinc = require('./boinc')
const os = require('os')
var AutoLaunch = require('auto-launch')
var launcher = new AutoLaunch({name:"Boid"})
function ec(error) { 
  console.error(error)
  ipcMain.emit('error', error)
}
var config = {}

const defaultConfig = {
  device:{
    cpid:false,
    wcgid:false,
    uid:false,
  },
  config:{
    startMinimized:false,
    addToStartup:true,
    stayAwake:true,
    firstRun:true,
  },
  state:{
    gpu:{
      toggle:false,
      logs:[],
      disabled:true
    },
    cpu:{
      toggle:false,
      logs:[],
      disabled:true
    },
    hdd:{
      toggle:false,
      logs:[],
      disabled:true
    }
  }
}

async function setupIPC(funcName) {
  console.log(funcName)
  const channel = 'config.' + funcName
  console.log(channel)

  ipcMain.on(channel, async (event, arg) => {
    ipc.init(event.sender,'config')
    console.log('IPC Event Received:', channel + '()')
    const emitChannel = channel.split('config.')[1]
    config.send(emitChannel, await (eval(channel)(arg)))
  })
}

config.send = (channel,data,data2) => ipc.send(channel,data,data2)
config.on = (channel,data) => ipc.on(channel,data)

config.reset = async function(cb){
  try {
    cfg.deleteAll()
    cfg.setAll(defaultConfig)
    const result = cfg.getAll()
    if (cb) return cb(result)
    else return result
  } catch (error) {
    ec(error)
  }
}

config.init = async function(force,cb){
  try {
    await config.updateDeviceID()
    if (!cfg.get('config')) cfg.set('config',defaultConfig.config)
    if (!cfg.get('state')) cfg.set('state', defaultConfig.state)
    var autoStart
    try {
      autoStart = await launcher.isEnabled()
    }catch(error){
      autoStart = false
      if(ec)ec(error)}
    cfg.set('config.addToStartup', autoStart )
    setupListeners()
    const result = cfg.getAll()
    handlestayAwake(result.config.stayAwake)
    handleAddToStartup(result.config.addToStartup)
    return result
  } catch (error) {ec(error)}
}

config.updateDeviceID = async function(){
  try {
    const deviceID = await duid()
    cfg.set('device.uid', deviceID)
    cfg.set('device.name', os.hostname())
    cfg.set('device.os', os.platform())
    const boincDevice = await boinc.state.getDevice()
    if (!boincDevice) return
    cfg.set('device.cpid',boincDevice.cpid)
    cfg.set('device.wcgid',boincDevice.wcgid)
  } catch (error) { ec(error) }
}
config.get = async function(){
  return cfg.getAll()
}
config.setConfig = async function(data){
  console.log('config set:',data)
  cfg.set('config',data)
}

  function handlestayAwake(data){
    console.log('handle stay awake', data)
    if (data) config.powerBlockerID = powerSaveBlocker.start('prevent-app-suspension') 
    else if (!data && config.powerBlockerID) powerSaveBlocker.stop(config.powerBlockerID)
  }

  async function handleAddToStartup(data){
    try {
      if (!data && await launcher.isEnabled()) launcher.disable()
      else launcher.enable()
    }catch(error){if(ec)ec(error)}


    // console.log('handle add to startup', data)
    
    // if (startup != data) app.setLoginItemSettings( {openAtLogin: data} ) 
    // const startup2 = app.getLoginItemSettings().openAtLogin
    // console.log(startup2)


  }

  function setupListeners(){
    cfg.watch('config.stayAwake', handlestayAwake)
    cfg.watch('config.addToStartup', handleAddToStartup)
    ipcMain.on('config.initIPC', event => ipc.init(event.sender,'config'))
    ipcMain.once('config.initIPC', event => {
      console.log('init config ipc')
      setupIPC('get')
      setupIPC('setConfig')
      ipc.on('getDevice',(data) => ipc.send('getDevice',cfg.get('device')))
      // ipc.on('getConfig',(data) => ipc.send('getConfig',cfg.get('config')))
      // ipc.on('getState', (data) => ipc.send('getState', cfg.get('state')))
      // ipc.on('set',(data,data2) => ipc.send('set',cfg.set(data,data2)))
    }
    )
  }
  
module.exports = config

// config.init()