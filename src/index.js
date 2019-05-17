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
require( './gpu' )
const menus = require('./menus.js')
var gpu = require('./gpu')
var cpu = require('./cpu')
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
// const powerBlocker = powerSaveBlocker.start( 'prevent-app-suspension' )
function setupTray() {
  tray = new Tray( path.join( __dirname, 'img', 'trayicon.png' ) )
  const contextMenu = Menu.buildFromTemplate( eval(menus.tray) )
  tray.setToolTip( 'Boid' )
  tray.setContextMenu( contextMenu )
  const editMenu = Menu.buildFromTemplate( require('./defaultMenu.json') )
  if ( thisPlatform === 'darwin' ) Menu.setApplicationMenu( editMenu )
}

async function setupWindow() {
  
  var appWindow = new BrowserWindow( {
    width: 450,
    height: 600,
    show: false,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    title: 'Boid Desktop',
    frame:true
  } )
  appWindow.loadURL( `file://${__dirname}/appwindow.html` )
  require('./registerGlobalListeners')(appWindow)
}


app.on( 'ready', async () => {
  device.init()
  config.init()
  state.init()
  setupTray()
  setupWindow()
})

var cleanUp = function( event ) {
  console.log( 'CLEANUP' )
  willQuitApp = true
}

process.on( 'uncaughtException', function( err ) {
  console.log( 'UNCAUCH EXCEPTION', err )
  dialog.showErrorBox( 'Boid Error', err )
  if (!isDev) app.quit()
} )