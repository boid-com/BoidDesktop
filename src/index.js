<<<<<<< HEAD
import { app, BrowserWindow, Menu, Tray, dialog, Notification } from 'electron'
=======
import { app, BrowserWindow, Menu, Tray, dialog, protocol, ipcMain } from 'electron'
const os = require('os')
>>>>>>> b5f346f0a7ba79d400f980fab2b6a90f17899cf0
const isDev = require('electron-is-dev')
const fixPath = require('fix-path')
const exec = require('child_process').exec
const config = require('electron-settings')
const auth = require('./auth')
const kill = require('tree-kill')
import firstRun from 'first-run'
import path from 'path'
import boinc from './boinc'
const config = require('electron-settings')
require('electron-debug')({ showDevTools: true })
if (require('electron-squirrel-startup')) app.quit()
const thisPlatform = os.platform()
var boinc = require('./boinc')
let tray
var authWindow = null
fixPath()
<<<<<<< HEAD
// app.dock.hide()
=======
>>>>>>> b5f346f0a7ba79d400f980fab2b6a90f17899cf0
app.setName('Boid')
protocol.registerStandardSchemes(['boid'])

auth.events.on('requestLogin', () => {
  console.log('Need to show Login Window')
  authWindow = new BrowserWindow({
    width: 800,
    height: 600
  })
  authWindow.on('closed', () => {
    win = null
  })
  authWindow.loadURL(`file://${__dirname}/auth.html`)
})

if (thisPlatform === 'win32') {
  console.log('found Windows Platform')
} else if (thisPlatform === 'darwin') {
  app.dock.hide()
  console.log('found MacOS platform')
}
if (!isDev && firstRun()) {
  app.setLoginItemSettings({
    openAtLogin: true
  })
}

function setupTray() {
  tray = new Tray(path.join(__dirname, 'img', 'trayIcon.png'))

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'quit',
      click() {
        app.quit()
      }
    },
    {
      label: 'Stop Boinc',
      click() {
        boinc.cmd('quit')
      }
    },
    {
      label: 'Item3',
      type: 'radio',
      checked: true
    },
    {
      label: 'Item4',
      type: 'radio'
    }
  ])

  tray.setToolTip('Boid')
  tray.setContextMenu(contextMenu)
  tray.on('click', () => {
    console.log('clicked!')
  })
  tray.on('click', (data) => {
    console.log(data)
  })
  // tray.displayBalloon({ title: 'test', content: 'this is content' })
<<<<<<< HEAD
}

async function authenticateUser() {
  console.log('get token', config.get('token'))
  if (!config.get('token')) return showUserLogin()
}

async function showUserLogin() {
  let win = new BrowserWindow({ show: false, width: 800, height: 600, titleBarStyle: 'hidden' })
  win.loadURL('https://app.boid.com')
  win.once('ready-to-show', () => {
    win.show()
  })

  win.on('closed', () => {
    win = null
  })
=======
>>>>>>> b5f346f0a7ba79d400f980fab2b6a90f17899cf0
}

var init = async () => {
  setupTray()
<<<<<<< HEAD
  // await authenticateUser()
  boinc.init().catch('error,lul')
=======
  auth.init()
  // protocol.registerHttpProtocol('boid')
  // boinc.init()
  ipcMain.on('getDevice', boinc.updateClientState)
  ipcMain.on('user', auth.parseUserData)
  ipcMain.on('token', auth.saveToken)
  boinc.events.on('deviceReady', (device) => {
    console.log('device is ready', device)
    if (authWindow) {
      console.log('found authWindow')
      authWindow.webContents.send('deviceReady', device)
    } else {
      console.log('no authwindow')
    }
  })
>>>>>>> b5f346f0a7ba79d400f980fab2b6a90f17899cf0
}

app.on('ready', init)

<<<<<<< HEAD
var handleException = function(error) {
  console.error(error)
  app.quit()
}
process.on('uncaughtException', handleException)
process.on('unhandledRejection', handleException)
=======
var cleanUp = function(event) {
  console.log('CLEANUP')
  kill(process.pid)
  boinc.killExisting()
  exec('Taskkill /IM boinc.exe /F')
}

app.on('before-quit', cleanUp)
app.on('quit', cleanUp)

app.on('window-all-closed', function() {
  console.log('All Windows Closed')
})
process.on('uncaughtException', function(err) {
  console.log(err)
  cleanUp()
})
>>>>>>> b5f346f0a7ba79d400f980fab2b6a90f17899cf0
