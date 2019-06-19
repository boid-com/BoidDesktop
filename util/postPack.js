const fs = require('fs-extra')
const os = require('os')
const exec = require('child_process').execSync
const resolve = require('path').resolve

if (os.platform() === 'win32'){
  fs.copyFileSync('./BOINC-Win32.zip','./out/Boid-win32-x64/Resources')
}
else if (os.platform() === 'darwin'){
  console.log('copying files')
  fs.copyFileSync(resolve('./BOINC.zip'),resolve('./out/Boid-darwin-x64/Boid.app/Contents/Resources/BOINC.zip'))
  console.log('signing .app')
  exec('electron-osx-sign ./out/Boid-darwin-x64/Boid.app/')
}