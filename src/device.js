const duid = require("machine-uuid")
const cfg = require( 'electron-settings' )
import {ipcMain,app,powerSaveBlocker} from 'electron'
const isDev = require( 'electron-is-dev' )

var device = {
  default: {
    cpid:false,
    wcgid:false,
    uid:false
  }
}
var ipc = null


device.reset = async function init(cb){
  try {
    cfg.delete('device')
    cfg.set('device',device.default)
    const deviceID = await duid()
    cfg.set('device.uid',deviceID)
    const result = cfg.get('device')
    if (cb) return cb(result)
    else return result
  } catch (error) {
    console.error(error)
    ipcMain.emit('error',error)
    return null
  }
}

device.init = async function init(){
    setupListeners()
    const savedID = cfg.get('device.uid')
    const deviceID = await duid()
    if (!savedID || deviceID != savedID ) return config.reset(config.init)
    await findBoincConfig()
    const result = cfg.getAll()
    handlestayAwake(result.stayAwake)
    handleAddToStartup(result.addToStartup)
    return result
  }

config.emit = async function ( channel, data, event ) {
    if ( ipc ) ipc.send( 'config.' + channel, data )
    else console.log( 'ipc not set!' )
    console.log( 'configEmit:', channel, data )
  },

config.on = async function ( channel, func) {
    channel = 'config.' + channel
    if ( ipc ) ipc.on( 'config.' + channel, (event,data,data2) => await func(data,data2) )
    else console.log( 'window not set!' )
    console.log( 'ConfigOn:', channel, func )
  },

  function handlestayAwake(data){
    if (data) config.powerBlockerID = powerSaveBlocker.start('prevent-app-suspension') 
    else if (!data && config.powerBlockerID) powerSaveBlocker.stop(config.powerBlockerID)
  }

  function handleAddToStartup(data){
      const startup = app.getLoginItemSettings().openAtLogin
      if ( !isDev && startup != data) app.setLoginItemSettings( {openAtLogin: data} ) 
  }

  function setupListeners(){
    cfg.watch('stayAwake', handlestayAwake)
    cfg.watch('addToStartup', handleAddToStartup)
    ipcMain.on('config.init', event => {ipc = event.sender,config.emit('init',true)})

    ipcMain.on('config')


    ipcMain.on('config.get', async (event,data) => {
      ipc = event.sender
      config.emit.send('config.get',await cfg.getAll())
    })

    ipcMain.on('config.set',(event,key,data)=>{
      try {
        event.sender.send('config.set',await cfg.get())
      } catch (error) {
        
      }
      cfg.set(key,data)
      ui.send('config.set',await cfg.get())
    })
  }



module.exports = device

// config.init()