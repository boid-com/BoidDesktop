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

require('electron-unhandled')()
require('fix-path')()

var thisPlatform = os.platform()
app.setName('Boid')
app.disableHardwareAcceleration()
let appWindow
let tray
let windowIPC
//let windowIntervalHandle

handleSecondInstance()
ipcMain.on('windowInitialized', (event, arg) => windowIPC = event.sender)
app.on('ready', async () => {
  config.init()
  setupTray()
  setupWindow()

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