import {ipcMain,app,shell} from 'electron'
const deviceID = require("machine-uuid")
const platform = require( 'os' ).platform()
const cfg = require( 'electron-settings' )
var gpu = require('./gpu')
var boinc = require('./boinc')
var ui
var isQuiting

function init(appWindow) {
  app.on('before-quit', async ()=>{
    isQuiting = true
    boinc.killExisting()
  })
  app.on('activate', () => appWindow.show)
  appWindow.on('ready-to-show', () => {
    if (platform === 'darwin') appWindow.setSize(450, 655), app.dock.show()
    else appWindow.setSize(460, 645)
    appWindow.setAutoHideMenuBar(true)
    appWindow.center()
    ipcMain.on('gpu.init',gpu.init)
    ipcMain.on('boinc.init',boinc.init)
    if (!cfg.get('config.startMinimized')) appWindow.show()
  })
  setupGlobalIPC()
  appWindow.on('minimize',e=>{e.preventDefault(),appWindow.hide()})
  appWindow.on('close', e => {
    if (isQuiting) return appWindow = null 
    e.preventDefault()
    appWindow.hide()
    if ( platform === 'darwin' ) app.dock.hide()
  })
}

function setupGlobalIPC(){
  ipcMain.on('openURL', (event, url) => {
    return shell.openExternal(url)
  })
  ipcMain.on('openDirectory', (event, dir) => {
    return shell.openItem(dir)
  })
}

module.exports = init