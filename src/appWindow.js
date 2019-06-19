const webview = document.getElementById('webview')
const msg = document.getElementById('loadingmsg')
var initial = true

webview.addEventListener('dom-ready', () => {
  // webview.openDevTools()
  if(!initial) return
  initial = false
  webview.setZoomLevel(0)

  webview.addEventListener('did-fail-load', (e, string) => {
    console.log('Failed to load')
    msg.style.display = "block"
    setTimeout(() => {
      webview.reload()
    }, 13000)
  })
  webview.addEventListener('page-title-updated', (e) => {
    msg.style.display = "none"
    console.log(e)
  })

})