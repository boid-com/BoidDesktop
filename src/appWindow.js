/*
 * Main window event and additional javascript
 */
const webview = document.getElementById('webview')
const msg = document.getElementById('loadingmsg')
var initial = true

/*
 * Event Description: Fired when document in the given frame is loaded.
 */
webview.addEventListener('dom-ready', () => {
  //webview.openDevTools()  //<--- This line must be commented out before commit to git.
  if(!initial) return
  initial = false
  webview.setZoomLevel(0)
})

const failToLoadPage = (e, string) => {
  console.log('Failed to load')
  msg.style.display = "block"
  setTimeout(() => {
    webview.reload()
  }, 13000)
}

/*
 * Event Description: This event is like did-finish-load, but fired when the load failed or was cancelled, e.g. window.stop() is invoked.
 */
webview.addEventListener('did-fail-load', failToLoadPage) //<--- Converted to a lambda in order to be used during the 'removeEventListener' call.

/*
 * Fired when page title is set during navigation.
 */
webview.addEventListener('page-title-updated', (e) => {
  msg.style.display = "none"
  console.log(e)
})

/*
 * Event Description: Fired when a load has committed. This includes navigation within the current document as well as subframe document-level loads, but does not include asynchronous resource loads.
 *
 * NOTE: This event is been used in order to cancel the reload of the server page.
 */
webview.addEventListener('load-commit', (e) => {
  console.log('Finished the loading process')
  webview.removeEventListener('did-fail-load', failToLoadPage)
})