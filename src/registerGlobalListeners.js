const {ipcMain,app,shell} = require('electron')
const platform = require( 'os' ).platform()
const cfg = require( 'electron-settings' )
var gpu = require('./gpu')
var boinc = require('./boinc')
const isDev = require('electron-is-dev')
const log = require('electron-log')
const path = require('path')
var isQuiting

function init(appWindow) {
  ipcMain.on('gpu.init',gpu.init)
  ipcMain.on('boinc.init',boinc.init)
  log.info('init listeners')
  app.on('before-quit', async ()=>{
    isQuiting = true
    if (appWindow) appWindow.close()
    if(boinc.process) await boinc.killExisting()  //<--- We must check if the 'process' is active prior killing it. If not, we get errors in console.
  })
  app.on('activate', () => appWindow.show)
  appWindow.on('ready-to-show', () => {
    if (platform === 'darwin') {
      appWindow.setSize(450, 655)
      app.dock.show()}
    else {appWindow.setSize(460, 665)}
    appWindow.setAutoHideMenuBar(true)
    appWindow.center()
    if (!cfg.get('config.startMinimized')) appWindow.show()
  })
  setupGlobalIPC()
  // appWindow.on('minimize',e=>{e.preventDefault(),appWindow.hide()})
  appWindow.on('close', e => {
    if (isQuiting) return appWindow = null 
    e.preventDefault()
    appWindow.hide()
    if ( platform === 'darwin' ) app.dock.hide()
  })
  if (isDev) appWindow.webContents.executeJavaScript("webview.loadURL('http://localhost:8080/desktop2')")
  else appWindow.webContents.executeJavaScript("webview.loadURL('https://app.boid.com/desktop2')")
}

function setupGlobalIPC(){
  ipcMain.on('openURL', (event, url) => {
    return shell.openExternal(url)
  })
  ipcMain.on('openDirectory', (event, dir) => {
    return shell.openItem(dir)
  })
  ipcMain.on('restart', (event,debug) =>{
    if (debug) app.relaunch({ args: process.argv.slice(1).concat(['--enable-logging']) })
    return app.exit()
  })
  ipcMain.on('openLogs', (event, dir) => {
    return shell.openItem(path.join(app.getPath('userData'),'log.log'))
  })
}

module.exports = init
