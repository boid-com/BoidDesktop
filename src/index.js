import {
  app,
  BrowserWindow,
  Menu,
  Tray,
  dialog,
  protocol,
  ipcMain
} from 'electron'
const os = require('os')
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
require('electron-debug')({
  showDevTools: true
})
if (require('electron-squirrel-startup')) app.quit()
const thisPlatform = os.platform()
var boinc = require('./boinc')
let tray
var authWindow = null
fixPath()
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

  const contextMenu = Menu.buildFromTemplate([{
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
}

var init = async () => {
  setupTray()
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
}

app.on('ready', init)

var cleanUp = function (event) {
  console.log('CLEANUP')
  kill(process.pid)
  boinc.killExisting()
  exec('Taskkill /IM boinc.exe /F')
}

app.on('before-quit', cleanUp)
app.on('quit', cleanUp)

app.on('window-all-closed', function () {
  console.log('All Windows Closed')
})
process.on('uncaughtException', function (err) {
  console.log(err)
  cleanUp()
})