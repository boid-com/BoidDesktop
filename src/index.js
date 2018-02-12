import { app, BrowserWindow, Menu, Tray, dialog, Notification } from 'electron'
const isDev = require('electron-is-dev')
const fixPath = require('fix-path')
import firstRun from 'first-run'
import path from 'path'
import boinc from './boinc'
const config = require('electron-settings')
require('electron-debug')({ showDevTools: true })

if (require('electron-squirrel-startup')) app.quit()

let tray
let auth

fixPath()
// app.dock.hide()
app.setName('Boid')

if (!isDev && firstRun()) {
  app.setLoginItemSettings({
    openAtLogin: true
  })
}

function setupTray() {
  tray = new Tray(path.join(__dirname, 'img', 'trayIcon.png'))

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
  // tray.displayBalloon({ title: 'test', content: 'this is content' })
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
}

var init = async () => {
  setupTray()
  // await authenticateUser()
  boinc.init().catch('error,lul')
}

app.on('ready', init)

var handleException = function(error) {
  console.error(error)
  app.quit()
}
process.on('uncaughtException', handleException)
process.on('unhandledRejection', handleException)
