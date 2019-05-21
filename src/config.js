const duid = require("machine-uuid")
const cfg = require( 'electron-settings' )
import {ipcMain,app,powerSaveBlocker} from 'electron'
import { ECANCELED } from 'constants';
const isDev = require( 'electron-is-dev' )
const ipc = require('./ipcWrapper')
const boinc = require('./boinc')
const os = require('os')
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

  function handlestayAwake(data){
    if (data) config.powerBlockerID = powerSaveBlocker.start('prevent-app-suspension') 
    else if (!data && config.powerBlockerID) powerSaveBlocker.stop(config.powerBlockerID)
  }

  function handleAddToStartup(data){
      const startup = app.getLoginItemSettings().openAtLogin
      if ( !isDev && startup != data) app.setLoginItemSettings( {openAtLogin: data} ) 
  }

  function setupListeners(){
    cfg.watch('config.stayAwake', handlestayAwake)
    cfg.watch('config.addToStartup', handleAddToStartup)
    ipcMain.on('config.initIPC', event => ipc.init(event.sender,'config'))
    ipcMain.once('config.initIPC', event => {
      console.log('init config ipc')
      ipc.on('getDevice',(data) => ipc.send('getDevice',cfg.get('device')))
      ipc.on('getConfig',(data) => ipc.send('getConfig',cfg.get('config')))
      ipc.on('getState', (data) => ipc.send('getState', cfg.get('state')))
      ipc.on('set',(data,data2) => ipc.send('set',cfg.set(data,data2)))
    }
    )
  }
  
module.exports = config

// config.init()