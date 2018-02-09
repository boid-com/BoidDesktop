const webview = document.querySelector('webview')
var { ipcRenderer, remote } = require('electron')
ipcRenderer.on('deviceReady', (event, device) => {
  webview.send('deviceReadyAuth', device)
})
ipcRenderer.on('user', (event, user) => {
  console.log(user)
})
webview.addEventListener('ipc-message', (event) => {
  if (event.channel === 'user') {
    console.log('receive User Event', event.args[0])
    ipcRenderer.send('user', event.args[0])
  } else if (event.channel === 'token') {
    console.log('received Token Event', event.args[0])
    ipcRenderer.send('token', event.args[0])
  }
})

webview.addEventListener('dom-ready', () => {
  console.log('dom ready')
  ipcRenderer.send('getDevice')
})
webview.addEventListener('console-message', (e) => {
  console.log('FROM WEBVIEW', e.message)
})
