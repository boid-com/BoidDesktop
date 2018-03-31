import { app, BrowserWindow, Menu, Tray, dialog, protocol, ipcMain, powerSaveBlocker } from 'electron'
const os = require('os')
const isDev = require('electron-is-dev')
const fixPath = require('fix-path')
const exec = require('child_process').exec
const auth = require('./auth')
const kill = require('tree-kill')
import firstRun from 'first-run'
import path from 'path'
import boinc from './boinc'
var config = null
// require('electron-debug')({
//   showDevTools: true
// })
if (require('electron-squirrel-startup')) app.quit()
const thisPlatform = os.platform()
let tray
var authWindow = null
fixPath()
app.setName('Boid')
app.disableHardwareAcceleration()
protocol.registerStandardSchemes(['boid'])
var appWindow
const id = powerSaveBlocker.start('prevent-app-suspension')
if (thisPlatform === 'win32') {
  console.log('found Windows Platform')
} else if (thisPlatform === 'darwin') {
  // app.dock.hide()
  console.log('found MacOS platform')
}

var powerBlocker

function setupTray() {
  tray = new Tray(path.join(__dirname, 'img', 'trayIcon.png'))

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open Window',
      click() {
        if (appWindow) {
          console.log('found exisiting appWindow')
          appWindow.show()
        } else {
          setupWindow()
        }
      }
    },
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

function setupWindow() {
  appWindow = new BrowserWindow({
    width: 440,
    height: 520,
    show: false,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    title: 'Boid Desktop'
  })
  if (isDev) appWindow.loadURL(`file://${__dirname}/appwindowDev.html`)
  else appWindow.loadURL(`file://${__dirname}/appwindow.html`)

  auth.events.on('requestLogin', () => {
    appWindow.webContents.send('requestLogin')
    appWindow.show()
  })

  appWindow.on('close', () => {
    console.log('got Close Event')
    app.dock.hide()
    appWindow = null
  })
  appWindow.on('minimize', () => {
    console.log('got Minimize Event')
  })
  appWindow.on('hide', () => {
    console.log('got Hide Event')
  })
  appWindow.onbeforeunload = (e) => {
    console.log('I do not want to be closed')
    e.returnValue = false
  }
  appWindow.on('ready-to-show', () => {
    appWindow.show()
    app.dock.show()
  })

  boinc.events.on('showWindow', () => {
    appWindow.once('hide', () => {
      console.log('got Hide Event')
      appWindow.show()
    })
  })

  // protocol.registerHttpProtocol('boid')
  // boinc.start()
  ipcMain.on('getDevice', boinc.updateClientState)
  ipcMain.on('localDevice', async (event) => {
    if (!boinc.device) await boinc.updateClientState().catch(console.log)
    event.returnValue = boinc.device
  })
  ipcMain.on('localDevice', async (event) => {
    if (!boinc.device) await boinc.updateClientState().catch(console.log)
    event.returnValue = boinc.device
  })
  ipcMain.on('boinc.cmd', (event, data) => {
    boinc.cmd(data)
  })
  ipcMain.on('startBoinc', boinc.start)
  ipcMain.on('initBoinc', boinc.init)
  ipcMain.on('boinc.config.get', boinc.config.get)
  ipcMain.on('boinc.config.set', (event, configData)=>{
    console.log('got ConfigData in Index',configData)
    boinc.config.set(configData)
  })
  ipcMain.on('boinc.activeTasks', async (event) => {
    try {
      var result = await boinc.activeTasks()
    } catch (error) {
      console.log(error)
    }
    // console.log('activeTasksResult', result)
    if (result) event.returnValue = result
    else event.returnValue = []
    //await boinc.activeTasks()
  })
  ipcMain.on('user', auth.parseUserData)
  ipcMain.on('token', auth.saveToken)
  ipcMain.on('getTokenSync', (event) => {
    var token = auth.returnToken()
    console.log(token)
    event.returnValue = token
  })
  boinc.events.on('activeTasks', (tasks) => {
    appWindow.webContents.send('boinc.activeTasks', tasks)
  })
  boinc.events.on('deviceReady', (device) => {
    // console.log('device is ready', device)
    if (appWindow) {
      appWindow.webContents.send('deviceReady', device)
    } else {
      console.log('no appWindow')
    }
  })
  boinc.events.on('toggle', (value) => {
    console.log('got toggle event in index')
    appWindow.webContents.send('boinc.toggle', value)
  })
  boinc.events.on('config', (value) => {
    appWindow.webContents.send('boinc.config', value)
  })
  boinc.events.on('suspended', (value) => {
    console.log('got suspended event in index')
    appWindow.webContents.send('boinc.suspended', value)
  })
  boinc.events.on('error', (value) => {
    console.log('got error event in index')
    appWindow.webContents.send('boinc.error', value)
  })
}
var init2 = function() {
  console.log(app.getPath('home'))
  boinc.init()
}
var init = async () => {
  setInterval(()=>{
    var metrics = app.getAppMetrics()
    // console.log(metrics)
  },5000)

  config = require('electron-settings')
  config.set('stayAwake', true)
  if (!isDev && firstRun()) {
    config.set('stayAwake', true)
    app.setLoginItemSettings({
      openAtLogin: true
    })
  }
  if (config.get('stayAwake')) {
    powerBlocker = powerSaveBlocker.start('prevent-app-suspension')
    console.log('STARTED BLOCKING SHUTDOWN', powerSaveBlocker.isStarted(powerBlocker))
  } else {
    if (powerBlocker) {
      powerSaveBlocker.stop(powerBlocker)
    }
  }
  setupTray()
  await setupWindow()
  setTimeout(() => {
    auth.init()
  }, 1000)
}
app.on('ready', init)

var cleanUp = function(event) {
  console.log('CLEANUP')
  kill(process.pid)
  boinc.killExisting()
}

app.on('before-quit', cleanUp)
app.on('quit', cleanUp)

app.on('window-all-closed', function() {
  console.log('All Windows Closed')
})
process.on('uncaughtException', function(err) {
  console.log('UNCAUCH EXCEPTION', err)
  cleanUp()
})

process.on('unhandledRejection', (r) => {
  console.log(r)
  setTimeout(() => {
    app.relaunch()
    app.exit()
  }, 10000)
})
