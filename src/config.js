const duid = require("machine-uuid")
const cfg = require( 'electron-settings' )
import {ipcMain,app} from 'electron'
const isDev = require( 'electron-is-dev' )

var config = {}

const defaultConfig = {
  startMinimized:false,
  addToStartup:true,
  firstRun:true,
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

config.reset = async function init(cb){
  try {
    cfg.deleteAll()
    cfg.setAll(defaultConfig)
    const deviceID = await duid()
    cfg.set('device.uid',deviceID)
    const result = cfg.getAll()
    if (cb) return cb(result)
    else return result
  } catch (error) {
    console.error(error)
    ipcMain.emit('error',error)
    return null
  }
}


config.init = async function init(){
    const savedID = cfg.get('device.uid')
    const deviceID = await duid()
    console.log(savedID,deviceID)
    if (!savedID || deviceID != savedID ) return config.reset(config.init)
    const result = cfg.getAll()
    const startup = app.getLoginItemSettings().openAtLogin
    console.log(startup)
    if ( !isDev && startup != result.addToStartup) app.setLoginItemSettings( {openAtLogin: result.addToStartup} ) 
    return result
  }



// config.set( 'stayAwake', true )
// if ( !isDev && firstRun() ) {
//   config.set( 'stayAwake', true )
//   app.setLoginItemSettings( {
//     openAtLogin: true
//   } )
// }
// if ( config.get( 'stayAwake' ) ) {
//   powerBlocker = powerSaveBlocker.start( 'prevent-app-suspension' )
//     // console.log('STARTED BLOCKING SHUTDOWN', powerSaveBlocker.isStarted(powerBlocker))
// } else {
//   if ( powerBlocker ) {
//     powerSaveBlocker.stop( powerBlocker )
//   }
// }

module.exports = config

// config.init()