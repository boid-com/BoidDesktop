const {ipcMain} = require('electron')

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
    console.log('Emit:', channel, data )
    this.ipc.send(channel,data)
    return true
  } catch (error) {
    console.error(error)
    ipcMain.emit('error',error)
    return false
  }
},
async on ( channel, func) {
  try {
    channel = this.prefix + '.' + channel
    console.log('On:', channel, func )
    ipcMain.on(channel,(event,data,data2) => func(data,data2))
  } catch (error) {
    console.error(error)
    ipcMain.emit('error',error)
  }

}
}
module.exports = () => wrapper