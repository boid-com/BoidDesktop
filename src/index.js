import {
  app,
  BrowserWindow,
  Menu,
  Tray,
  dialog,
  ipcMain,
  powerSaveBlocker,
} from 'electron'
import firstRun from 'first-run'
import path from 'path'
import boinc from './boinc'
const os = require( 'os' )
const isDev = require( 'electron-is-dev' )
const auth = require( './auth' )
require( 'electron-unhandled' )()
require( './gpu' )
const menus = require('./menus.js')
var config = null
const deviceID = require("machine-uuid")
if ( require( './squirrelHandler' ) ) app.quit()
require( 'fix-path' )()
var thisPlatform = os.platform()
let tray
var willQuitApp = false
app.setName( 'Boid' )
app.disableHardwareAcceleration()
var appWindow
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
  if ( thisPlatform === 'win32' ) appWindow.setMenu( null )
  // require('./registerGlobalListeners')(ipcMain,app,appWindow)
}


app.on( 'ready', async () => {
  console.log('ready')
  require('./config').init()
  require('./gpu')
  // require('./cpu')
  setupTray()
  await setupWindow()
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