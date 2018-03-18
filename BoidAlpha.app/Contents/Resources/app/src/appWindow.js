const webview = document.querySelector('webview')
var { ipcRenderer, remote } = require('electron')
const isDev = require('electron-is-dev')
var auth = require('./auth')
setTimeout(() => {
  window.scrollTo(10, 10)
}, 100)
webview.addEventListener('dom-ready', () => {
  if (isDev) {
    webview.openDevTools()
  }
  webview.setZoomLevel(0)

  ipcRenderer.on('requestLogin', () => {
    console.log('got login auth request')
  })

  ipcRenderer.on('deviceReady', (event, device) => {
    console.log('got DeviceReady Event from main')
    webview.send('deviceReadyAuth', device)
  })
  ipcRenderer.on('user', (event, user) => {
    console.log(user)
  })

  ipcRenderer.on('boinc.toggle', (event, toggle) => {
    console.log('GOT TOGGLE EVENT', toggle)
    webview.send('boinc.toggle', toggle)
  })

  ipcRenderer.on('boinc.activeTasks', (event, tasks) => {
    webview.send('boinc.activeTasks', tasks)
  })
  webview.addEventListener('ipc-message', (event) => {
    if (event.channel === 'user') {
      console.log('receive User Event', event.args[0])
      ipcRenderer.send('user', event.args[0])
    } else if (event.channel === 'token') {
      console.log('received Token Event', event.args[0])
      ipcRenderer.send('token', event.args[0])
    } else if (event.channel === 'getTokenSync') {
      console.log('got getTokenSync request')
    }
  })

  webview.addEventListener('dom-ready', () => {
    console.log('dom ready')
    ipcRenderer.send('getDevice')
  })
  webview.addEventListener('console-message', (e) => {
    console.log('FROM WEBVIEW', e.message)
  })
})
