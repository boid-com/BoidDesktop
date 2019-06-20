const tray = `[
  {
    label: 'Open Boid',
    click() {
      if ( appWindow ) {
        appWindow.show()
      } else {
        setupWindow()
      }
    }
  },
  {
    label: 'Exit Boid',
    click() {
      appWindow.hide()
      app.quit()
    }
  }
]`
module.exports = {tray}