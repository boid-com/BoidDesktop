import {ipcMain,app,shell} from 'electron'
const deviceID = require("machine-uuid")
const platform = require( 'os' ).platform()
const cfg = require( 'electron-settings' )
var ui

function init(appWindow) {
  app.on('activate', () => appWindow.show)

  appWindow.on( 'close', e => {
    e.preventDefault()
    appWindow.hide()
    if ( platform === 'darwin' ) app.dock.hide()
  })
  

  appWindow.on('ready-to-show', () => {
    appWindow.show()
    if (platform === 'darwin') appWindow.setSize(450, 620), app.dock.show()
    else appWindow.setSize(460, 645)
    appWindow.setAutoHideMenuBar(true)
    appWindow.center()
  })


  // ipcMain.on('getDevice', boinc.updateClientState)
  // ipcMain.on('localDevice', async (event) => {
  //   if (!boinc.device) await boinc.updateClientState().catch(console.log)
  //   event.returnValue = boinc.device
  // })
  // ipcMain.on('boinc.cmd', (event, data) => {
  //   boinc.cmd(data)
  // })
  // ipcMain.on('startBoinc', boinc.start)
  ipcMain.on('openURL', (event, url) => {
    return shell.openExternal(url)
  })
  // ipcMain.on('openDirectory', (event, dir) => {
  //   return shell.openItem(dir)
  // })
  // ipcMain.on('initBoinc', () => {
  //   boinc.start()
  // })
  // ipcMain.on('boinc.config.get', boinc.config.get)
  // ipcMain.on('boinc.config.set', (event, configData) => {
  //   console.log('got ConfigData in Index', configData)
  //   boinc.config.set(configData)
  // })
  // ipcMain.on('boinc.activeTasks', async (event) => {
  //   try {
  //     boinc.activeTasks()
  //   } catch (error) {
  //     console.log(error)
  //   }
  // })
  // ipcMain.on('user', auth.parseUserData)
  // ipcMain.on('token', auth.saveToken)
  // ipcMain.on('getTokenSync', (event) => {
  //   var token = auth.returnToken()
  //   console.log(token)
  //   event.returnValue = token
  // })

}

module.exports = init