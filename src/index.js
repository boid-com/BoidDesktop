import {
  app,
  BrowserWindow,
  Menu,
  Tray,
  dialog,
  ipcMain,
  powerSaveBlocker,
} from 'electron'
import path from 'path'
const os = require( 'os' )
const isDev = require( 'electron-is-dev' )
require( 'electron-unhandled' )()
const menus = require('./menus.js')
// var cpu = require('./cpu')
const config = require('./config')
if ( require( './squirrelHandler' ) ) app.quit()
require( 'fix-path' )()
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
    frame: true
  })
  appWindow.loadURL(`file://${__dirname}/appwindow.html`)
  require('./registerGlobalListeners')(appWindow)
  appWindow.on('closed',()=>{appWindow = null})
}

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
    }
  ])
  tray.setToolTip('Boid')
  tray.setContextMenu(contextMenu)
  const editMenu = Menu.buildFromTemplate(require('./defaultMenu.json'))
  if (thisPlatform === 'darwin') Menu.setApplicationMenu(editMenu)
}



function handleSecondInstance(){
  const isSecondInstance = app.makeSingleInstance((commandLine, workingDirectory) => {
      if (appWindow) {
          if (appWindow.isMinimized()) appWindow.restore()
          appWindow.show()
          appWindow.focus()
      }
  })

  if (isSecondInstance) {
      app.quit()
  }


  // if (!app.requestSingleInstanceLock()) return app.quit()
  
  // app.on('second-instance', (event, commandLine, workingDirectory) => {
  //   if (appWindow) {
  //     if (appWindow.isMinimized()) appWindow.restore()
  //     appWindow.show()
  //     appWindow.focus()
  //   }
  // })
}

process.on( 'uncaughtException', function( err ) {
  console.log( 'UNCAUGHT EXCEPTION', err )
  dialog.showErrorBox( 'Critical Boid Error', err )
  // if (!isDev) app.quit()
  // app.quit()
} )