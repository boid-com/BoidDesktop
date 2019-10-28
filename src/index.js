const {
  app,
  BrowserWindow,
  Menu,
  Tray,
  ipcMain
} = require('electron')
if(require('electron-squirrel-startup')) { // eslint-disable-line global-require
  app.quit()
}
const log = require('electron-log')
const config = require('./config')
const path = require('path')
const os = require('os')
const ipc = require('./ipcWrapper')()             //<--- Require-in the ipc wrapper for send the events to the site.
const electron = require('electron')              //<--- Require the electron module. Used for the 'powerMonitor' sub-module.
const boinc = require('./boinc')                  //<--- Require the boinc object in order to gain access to the global application state.
const boidAppEvents = require('./boidAppEvents')  //<--- Our In-House nodeJS module for events sub/sink.
const gpu = require('./gpu')                      //<--- Require the boinc object in order to gain access to the global application state.

require('electron-unhandled')()
require('fix-path')()

var thisPlatform = os.platform()
app.setName('Boid')
app.disableHardwareAcceleration()
let appWindow
let tray
let windowIPC
//let windowIntervalHandle
let powerMonitor
let intervalTimer=3000

handleSecondInstance()
ipcMain.on('windowInitialized', (event, arg) => windowIPC = event.sender)
app.on('ready', async () => {
  config.init()
  setupTray()
  setupWindow()

  var tmpGlobalConfigObj=await boinc.prefs.read()

  powerMonitor=electron.powerMonitor
  //Send the on-batteries event to the site to handle any BOINC client suspension.....
  powerMonitor.on('on-battery', async () => {
    //var tmpConfigObj=await config.get()
    var tmpCPUBoincObj=await boinc.config.read()
    var tmpGPUBoincObj=await gpu.config.read()

    if(!tmpCPUBoincObj.run_on_batteries){
      boidAppEvents.emit('boinc.suspend')
      ipc.send('log', "Suspending computation - on batteries")
    }

    if(!tmpGPUBoincObj.run_on_batteries){
      boidAppEvents.emit('gpu.suspend')
      ipc.send('log', "Suspending computation - on batteries")
    }
  })

  powerMonitor.on('on-ac', async () => {
    //var tmpConfigObj=await config.get()
    var tmpCPUBoincObj=await boinc.config.read()
    var tmpGPUBoincObj=await gpu.config.read()

    if(!tmpCPUBoincObj.run_on_batteries){
      boidAppEvents.emit('boinc.resume')
      ipc.send('log', "Resuming computation")
    }

    if(!tmpGPUBoincObj.run_on_batteries){
      boidAppEvents.emit('gpu.resume')
      ipc.send('log', "Resuming computation")
    }
  })

  //Send the on-use event to the site to handle any BOINC client suspension.....
  function _timeoutCPUFunction(){
    powerMonitor.querySystemIdleTime(async function(idleTime){
      var tmpConfigObj=await config.get()
      var tmpCPUBoincObj=await boinc.config.read()

      if(tmpConfigObj.state.cpu.toggle && !tmpCPUBoincObj.run_if_user_active) {
        if(idleTime===0){
          await ipc.send('log', "Suspending computation - computer is in use")
          await boidAppEvents.emit('boinc.suspend')

          intervalTimer=parseInt(tmpCPUBoincObj.idle_time_to_run, 10) * 60000
          setTimeout(_timeoutCPUFunction, intervalTimer)
        }else{
          await ipc.send('log', "Resuming computation")
          await boidAppEvents.emit('boinc.resume')

          intervalTimer=5000
          setTimeout(_timeoutCPUFunction, intervalTimer)
        }
      }else{
        setTimeout(_timeoutCPUFunction, intervalTimer)
      }
    })
  }

//Send the on-use event to the site to handle any GPU client suspension.....
function _timeoutGPUFunction(){
  powerMonitor.querySystemIdleTime(async function(idleTime){
    var tmpConfigObj=await config.get()
    var tmpGPUBoincObj=await gpu.config.read()

    if(tmpConfigObj.state.gpu.toggle && !tmpGPUBoincObj.run_if_user_active) {
      if(idleTime===0){
        await ipc.send('log', "Suspending computation - computer is in use")
        await boidAppEvents.emit('gpu.suspend')

        intervalTimer=parseInt(tmpGPUBoincObj.idle_time_to_run, 10) * 60000
        setTimeout(_timeoutGPUFunction, intervalTimer)
      }else{
        await ipc.send('log', "Resuming computation")
        await boidAppEvents.emit('gpu.resume')

        intervalTimer=5000
        setTimeout(_timeoutGPUFunction, intervalTimer)
      }
    }else{
      setTimeout(_timeoutGPUFunction, intervalTimer)
    }
  })
}
  
  setTimeout(_timeoutCPUFunction, intervalTimer)
  setTimeout(_timeoutGPUFunction, intervalTimer)

  //Send the on-use event to the site to handle any BOINC client suspension.....
  /*
  windowIntervalHandle = setInterval(async function(){
    powerMonitor.querySystemIdleTime(async function(idleTime){
      var tmpConfigObj=await config.get()
      var tmpCPUBoincObj=await boinc.config.read()

      if(tmpConfigObj.state.cpu.toggle && !tmpCPUBoincObj.run_if_user_active) {
        if(idleTime===0){
          await ipc.send('log', "Suspending computation - computer is in use")
          await boidAppEvents.emit('boinc.suspend')
        }else{
          await ipc.send('log', "Resuming computation")
          await boidAppEvents.emit('boinc.resume')
        }
      }
    })
  }, 5000)
  */


})

async function setupWindow () {
  appWindow = new BrowserWindow({
    width: 450,
    height: 655,
    show: false,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    title: 'Boid Desktop ' + app.getVersion(),
    frame: true,
    webPreferences: {
      nodeIntegration: false,
      enableRemoteModule:false,
      webviewTag: true
    }
  })
  appWindow.loadURL(`file://${__dirname}/appwindow.html`)
  require('./registerGlobalListeners')(appWindow)
  appWindow.on('closed', () => {
    appWindow = null
    //clearInterval(windowIntervalHandle)
  })
}

function setupTray () {
  tray = new Tray(path.join(__dirname, 'img', 'trayicon.png'))
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open Boid',
      click () {
        if(appWindow) {
          appWindow.show()
        } else {
          setupWindow()
        }
      }
    },
    {
      label: 'Exit Boid',
      click () {
        // appWindow.hide()
        app.quit()
      }
    },
    {
      label: 'Debug',
      click () {
        if(appWindow) {
          appWindow.webContents.executeJavaScript('webview.openDevTools()')
        }
      }
    }
  ])
  tray.setToolTip('Boid')
  tray.setContextMenu(contextMenu)
  const editMenu = Menu.buildFromTemplate(require('./defaultMenu.json'))
  if(thisPlatform === 'darwin') Menu.setApplicationMenu(editMenu)
}

function handleSecondInstance () {
  if(!app.requestSingleInstanceLock()) return app.quit()

  app.on('second-instance', (event, commandLine, workingDirectory) => {
    if(appWindow) {
      if(appWindow.isMinimized()) appWindow.restore()
      appWindow.show()
      appWindow.focus()
    }
  })
}