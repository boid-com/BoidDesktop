import { app, BrowserWindow, Menu, Tray, dialog, protocol, ipcMain, powerSaveBlocker, shell } from 'electron'
import firstRun from 'first-run'
import path from 'path'
import boinc from './boinc'
const os = require('os')
const isDev = require('electron-is-dev')
const fixPath = require('fix-path')
const auth = require('./auth')
const unhandled = require('electron-unhandled')
const gpu = require('./gpu')
unhandled()
var config = null
require('electron-debug')({
  // showDevTools: true
})
if (require('./squirrelHandler')) app.quit()

const thisPlatform = os.platform()
let tray
fixPath()
var willQuitApp = false
app.setName('Boid')
app.disableHardwareAcceleration()
protocol.registerStandardSchemes(['boid'])
var appWindow
const id = powerSaveBlocker.start('prevent-app-suspension')
// console.log(id)
if (thisPlatform === 'win32') {
  console.log('found Windows Platform')
} else if (thisPlatform === 'darwin') {
  // app.dock.hide()
  console.log('found MacOS platform')
}

const isSecondInstance = app.makeSingleInstance((commandLine, workingDirectory) => {
  if (appWindow) {
    appWindow.restore()
    appWindow.show()
    appWindow.focus()
  }
  // console.log('make single ins')
})

if (isSecondInstance) {
  app.quit()
}

var powerBlocker

function setupTray () {
  tray = new Tray(path.join(__dirname, 'img', 'trayicon.png'))

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open Boid',
      click () {
        if (appWindow) {
          console.log('found exisiting appWindow')
          appWindow.show()
        } else {
          setupWindow()
        }
      }
    },
    {
      label: 'Exit Boid',
      click () {
        boinc.cmd('quit')
        appWindow.hide()
        setTimeout(() => {
          app.quit()
        }, 5000)
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

  const editMenu = Menu.buildFromTemplate([
    {
      label: 'Edit',
      submenu: [
        { label: 'Undo', accelerator: 'CmdOrCtrl+Z', selector: 'undo:' },
        { label: 'Redo', accelerator: 'Shift+CmdOrCtrl+Z', selector: 'redo:' },
        { type: 'separator' },
        { label: 'Cut', accelerator: 'CmdOrCtrl+X', selector: 'cut:' },
        { label: 'Copy', accelerator: 'CmdOrCtrl+C', selector: 'copy:' },
        { label: 'Paste', accelerator: 'CmdOrCtrl+V', selector: 'paste:' },
        { label: 'Select All', accelerator: 'CmdOrCtrl+A', selector: 'selectAll:' }
      ]
    }
  ])

  Menu.setApplicationMenu(editMenu) // Enable keyboard shortcuts
}

function setupWindow () {
  appWindow = new BrowserWindow({
    width: 450,
    height: 600,
    show: false,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    title: 'Boid Desktop'
  })
  appWindow.loadURL(`file://${__dirname}/appwindow.html`)

  appWindow.on('close', (e) => {
    if (willQuitApp) {
      appWindow = null
    } else {
      e.preventDefault()
      appWindow.hide()
      console.log(thisPlatform)
      if (thisPlatform === 'darwin') app.dock.hide()
    }
  })

  auth.events.on('requestLogin', () => {
    console.log('got REQUEST LOGIN')
    appWindow.webContents.send('requestLogin')
    appWindow.show()
  })
  app.on('activate', () => appWindow.show())

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
    console.log('app window ready to show')
    appWindow.show()
    if (thisPlatform === 'darwin') appWindow.setSize(450, 620)
    else appWindow.setSize(460, 630)
    appWindow.setAutoHideMenuBar(true)

    appWindow.center()
    gpu.init(appWindow)
    // if (isDev) appWindow.showDevTools()
    if (thisPlatform === 'darwin') app.dock.show()
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
  ipcMain.on('boinc.cmd', (event, data) => {
    boinc.cmd(data)
  })
  ipcMain.on('startBoinc', boinc.start)
  ipcMain.on('openURL', (event, url) => {
    return shell.openExternal(url)
  })
  ipcMain.on('initBoinc', () => { boinc.start() })
  ipcMain.on('boinc.config.get', boinc.config.get)
  ipcMain.on('boinc.config.set', (event, configData) => {
    console.log('got ConfigData in Index', configData)
    boinc.config.set(configData)
  })
  ipcMain.on('boinc.activeTasks', async (event) => {
    try {
      boinc.activeTasks()
    } catch (error) {
      console.log(error)
    }
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
  boinc.events.on('error', (value, other) => {
    console.log('got BOINC error event in index')
    console.log(value.toString())
    console.log(other)
    // dialog.showErrorBox('Boid Error',value)
    appWindow.webContents.send('boinc.error', value)
  })
}

var init = async () => {
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
    // console.log('STARTED BLOCKING SHUTDOWN', powerSaveBlocker.isStarted(powerBlocker))
  } else {
    if (powerBlocker) {
      powerSaveBlocker.stop(powerBlocker)
    }
  }
  setupTray()
  await setupWindow()

  // setTimeout(() => {
  //   auth.init()
  // }, 1000)
}
app.on('ready', () => {
  init()
})

var cleanUp = function (event) {
  console.log('CLEANUP')
  willQuitApp = true
  // kill(process.pid)
  boinc.killExisting()
}

app.on('before-quit', cleanUp)
app.on('quit', cleanUp)

app.on('window-all-closed', function () {
  console.log('All Windows Closed')
})
process.on('uncaughtException', function (err) {
  console.log('UNCAUCH EXCEPTION', err)
  dialog.showErrorBox('Boid Error', err)
  // cleanUp()
})

process.on('unhandledRejection', (r) => {
  console.log('UNHANDLED REJECTION:', r)
  // setTimeout(() => {
  //   app.relaunch()
  //   app.exit()
  // }, 10000)
})
