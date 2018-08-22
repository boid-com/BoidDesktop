const webview = document.querySelector('webview')
const msg = document.getElementById('loadingmsg')
var { ipcRenderer, remote } = require('electron')
// const unhandled = require('electron-unhandled');
// unhandled()
const isDev = require('electron-is-dev')
var auth = require('./auth')
var reloadInterval = null
setTimeout(() => {
  window.scrollTo(8, 10)
}, 100)
console.log('appWindow loaded')
var initial = true

webview.addEventListener('dom-ready', () => {
  if (isDev) webview.openDevTools()
  ipcRenderer.send('getDevice')
  if (!initial) return 
  initial = false
  webview.setZoomLevel(0)
  
  ipcRenderer.on('requestLogin', () => {
    console.log('got login auth request')
  })

  ipcRenderer.on('deviceReady', (event, device) => {
    webview.send('deviceReadyAuth', device)
  })
  ipcRenderer.on('user', (event, user) => {
    console.log(user)
  })

  ipcRenderer.on('boinc.toggle', (event, toggle) => {
    webview.send('boinc.toggle', toggle)
  })

  ipcRenderer.on('boinc.suspended', (event, toggle) => {
    webview.send('boinc.suspended', toggle)
  })
  ipcRenderer.on('boinc.config', (event, value) => {
    webview.send('boinc.config', value)
  })
  ipcRenderer.on('boinc.error', (event, value) => {
    webview.send('boinc.error', value)
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
  webview.addEventListener('did-fail-load',(e,string)=>{
    console.log('Failed to load')
    console.log(string)
    msg.style.display = "inline"
    reloadInterval = setInterval(()=>{
      webview.reload()
    },3000)
  })
  webview.addEventListener('did-finish-load',(e)=>{
    if (reloadInterval) clearInterval(reloadInterval)
    msg.style.display = "none"
    console.log(e)
  })
  if (isDev) webview.loadURL('http://localhost:8080/device')
  else webview.loadURL('https://app.boid.com/device')
})
