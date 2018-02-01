import { app, BrowserWindow, Menu, Tray, dialog } from 'electron'
const os = require('os')
const isDev = require('electron-is-dev')
const fixPath = require('fix-path')
import firstRun from 'first-run'
import path from 'path'
require('electron-debug')({ showDevTools: true })
if (require('electron-squirrel-startup')) app.quit()
const thisPlatform = os.platform()

let tray
let auth

fixPath()
app.setName('Boid')

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
  tray = new Tray(__dirname + '/img/trayIcon.png')

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Item1', type: 'radio' },
    { label: 'Item2', type: 'radio' },
    { label: 'Item3', type: 'radio', checked: true },
    { label: 'Item4', type: 'radio' }
  ])
  tray.setToolTip('Boid')
  tray.setContextMenu(contextMenu)
  tray.on('click', () => {
    console.log('clicked!')
  })
  tray.on('click', (data) => {
    console.log(data)
  })
  tray.displayBalloon({ title: 'test', content: 'this is content' })
}

var init = async () => {
  setupTray()
}

app.on('ready', init)

process.on('uncaughtException', handleException)

function handleException(error) {
  console.error(error)
  app.quit()
}
