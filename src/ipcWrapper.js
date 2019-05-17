import {ipcMain} from 'electron'


var wrapper = {
prefix:"",
ipc:null,
init(ipc,prefix){
  this.prefix = prefix
  this.ipc = ipc
}, 
async emit ( channel, data) {
  try {
    channel = this.prefix + '.' + channel
    console.log('Emit:', channel, data )
    this.ipc.send( channel, data )
    return true
  } catch (error) {
    console.error(error)
    ipcMain.emit('error',error)
    return false
  }
},
async on ( channel, func) {
  channel = 'config.' + channel
  // if ( ipc ) ipc.on( 'config.' + channel, (event,data,data2) => await func(data,data2) )
  // else console.log( 'window not set!' )
  console.log( 'On:', channel, func )
},
}

module.exports = wrapper

wrapper.init('dopeAF')
wrapper.emit('peacedude')