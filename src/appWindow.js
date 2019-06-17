// const {ipcRenderer} = require('electron')
const webview = document.getElementById( 'webview' )
const msg = document.getElementById( 'loadingmsg' )
// const isDev = require( 'electron-is-dev' )
var initial = true

webview.addEventListener( 'dom-ready', () => {
  webview.openDevTools()
  console.log('windowInitialized')
  // ipcRenderer.on('openConsole',() => webview.openDevTools())
  if ( !initial ) return
  initial = false
  webview.setZoomLevel( 0 )

  webview.addEventListener( 'did-fail-load', ( e, string ) => {
    console.log( 'Failed to load' )
    msg.style.display = "block"
    setTimeout( () => {
      webview.reload()
    }, 3000 )

  } )
  webview.addEventListener( 'page-title-updated', ( e ) => {
    msg.style.display = "none"
    console.log( e )
  } )
  return webview.loadURL( 'https://app.boid.com/desktop2' )
  if ( isDev ) webview.loadURL( 'http://localhost:8080/desktop2' )
  else webview.loadURL( 'https://app.boid.com/desktop2' )
} )