const deviceID = require("machine-uuid")


function init(ipcMain, app, appWindow) {

  app.on('activate', () => appWindow.show)

  appWindow.onbeforeunload = (e) => e.returnValue = false

  appWindow.on( 'close', e => {
    if ( willQuitApp ) {
      appWindow = null
    } else {
      e.preventDefault()
      appWindow.hide()
      console.log( thisPlatform )
      if ( thisPlatform === 'darwin' ) app.dock.hide()
    }
  } )

  appWindow.on('ready-to-show', () => {
    appWindow.show()
    if (thisPlatform === 'darwin') appWindow.setSize(450, 620)
    else appWindow.setSize(460, 645)
    appWindow.setAutoHideMenuBar(true)
    appWindow.center()
    if (thisPlatform === 'darwin') app.dock.show()
  })

  ipcMain.on('deviceID', async () => await deviceID())
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
  ipcMain.on('openDirectory', (event, dir) => {
    return shell.openItem(dir)
  })
  ipcMain.on('initBoinc', () => {
    boinc.start()
  })
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

module.exports = init