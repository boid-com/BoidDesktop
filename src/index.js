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
const device = require('./device')
if ( require( './squirrelHandler' ) ) app.quit()
require( 'fix-path' )()
var thisPlatform = os.platform()
let tray
var willQuitApp = false
app.setName( 'Boid' )
app.disableHardwareAcceleration()
var appWindow
var webView

app.on( 'ready', async () => {
  console.log(app.getPath('appData'))
  config.init()
  setupTray()
  setupWindow()
})

async function setupWindow() {
  var appWindow = new BrowserWindow({
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
}

function setupTray() {
  tray = new Tray(path.join(__dirname, 'img', 'trayicon.png'))
  const contextMenu = Menu.buildFromTemplate(eval(menus.tray))
  tray.setToolTip('Boid')
  tray.setContextMenu(contextMenu)
  const editMenu = Menu.buildFromTemplate(require('./defaultMenu.json'))
  if (thisPlatform === 'darwin') Menu.setApplicationMenu(editMenu)
}



process.on( 'uncaughtException', function( err ) {
  console.log( 'UNCAUGHT EXCEPTION', err )
  dialog.showErrorBox( 'Critical Boid Error', err )
  // if (!isDev) app.quit()
} )