const {ipcMain} = require('electron')
const log = require('electron-log')

var wrapper = {
prefix:"",
ipc:null,
init(ipc,prefix){
  this.prefix = prefix
  this.ipc = ipc
}, 
async send ( channel, data) {
  try {
    channel = this.prefix + '.' + channel
    if (channel === 'boinc.state.getUI' && data) log.info('Emit:', channel, 'Success')
    else log.info('Emit:',channel,data)
    this.ipc.send(channel,data)
    return true
  } catch (error) {
    log.error(error)
    ipcMain.emit('error',error)
    return false
  }
},
async on ( channel, func) {
  try {
    channel = this.prefix + '.' + channel
    log.info('On:', channel, func )
    ipcMain.on(channel,(event,data,data2) => func(data,data2))
  } catch (error) {
    log.error(error)
    ipcMain.emit('error',error)
  }

}
}
module.exports = () => wrapper