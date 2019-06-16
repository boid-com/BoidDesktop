import {
  app,
  BrowserWindow,
  Menu,
  Tray,
  dialog,
  ipcMain
} from 'electron'
if (require('electron-squirrel-startup')) { // eslint-disable-line global-require
  app.quit()
}
import path from 'path'
const os = require( 'os' )
require( 'electron-unhandled' )()
// var cpu = require('./cpu')
const config = require('./config')
// if ( require( './squirrelHandler' ) ) app.quit()

require( 'fix-path' )()
// if (require('./squirrelHandler')) {
//   app.quit()
//   process.exit(0)
// }

var thisPlatform = os.platform()
let tray
app.setName( 'Boid' )
app.disableHardwareAcceleration()
var appWindow
var webView

handleSecondInstance()

app.on( 'ready', async () => {
  console.log(app.getPath('appData'))
  config.init()
  setupTray()
  setupWindow()
})

async function setupWindow() {
  appWindow = new BrowserWindow({
    width: 450,
    height: 600,
    show: false,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    title: 'Boid Desktop',
    frame: true,
    webviewTag:true
  })
  appWindow.loadURL(`file://${__dirname}/appwindow.html`)
  require('./registerGlobalListeners')(appWindow)
  appWindow.on('closed',() => appWindow = null)
}

var windowIPC

function setupTray() {
  tray = new Tray(path.join(__dirname, 'img', 'trayicon.png'))
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open Boid',
      click() {
        if ( appWindow ) {
          console.log( 'found existing appWindow' )
          appWindow.show()
        } else {
          setupWindow()
        }
      }
    },
    {
      label: 'Exit Boid',
      click() {
        // appWindow.hide()
        app.quit()
      }
    },
    {
      label: 'Debug',
      click(){
        if (windowIPC) {
          // console.log(windowIPC)
          windowIPC.send('openConsole')
        }
      }
    }
  ])
  tray.setToolTip('Boid')
  tray.setContextMenu(contextMenu)
  const editMenu = Menu.buildFromTemplate(require('./defaultMenu.json'))
  if (thisPlatform === 'darwin') Menu.setApplicationMenu(editMenu)
  else Menu.setApplicationMenu([])
}

ipcMain.on('windowInitialized', (event, arg) => windowIPC = event.sender )

function handleSecondInstance(){
  // const isSecondInstance = app.makeSingleInstance((commandLine, workingDirectory) => {
  //     if (appWindow) {
  //         if (appWindow.isMinimized()) appWindow.restore()
  //         appWindow.show()
  //         appWindow.focus()
  //     }
  // })

  // if (isSecondInstance) {
  //     app.quit()
  // }

  if (!app.requestSingleInstanceLock()) return app.quit()

  app.on('second-instance', (event, commandLine, workingDirectory) => {
    if (appWindow) {
      if (appWindow.isMinimized()) appWindow.restore()
      appWindow.show()
      appWindow.focus()
    }
  })
}



process.on( 'uncaughtException', function( err ) {
  console.log( 'UNCAUGHT EXCEPTION', err )
  dialog.showErrorBox( 'Critical Boid Error', err )
  // if (!isDev) app.quit()
  // app.quit()
} )