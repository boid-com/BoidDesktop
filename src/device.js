const duid = require("machine-uuid")
const cfg = require( 'electron-settings' )
import {ipcMain,app,powerSaveBlocker} from 'electron'
const isDev = require( 'electron-is-dev' )
const ipc = require('./ipcWrapper')

var device = {
  default: {
    cpid:false,
    wcgid:false,
    uid:false
  }
}
device.init = async function init(){
  try {
    const deviceID = await duid()
    cfg.set('device.uid',deviceID)
    const result = cfg.get('device')
    return result
  } catch (error) {
    console.error(error)
    ipcMain.emit('error',error)
    return null
  }
}


module.exports = device

// config.init()