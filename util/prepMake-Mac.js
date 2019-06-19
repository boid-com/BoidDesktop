const fs = require('fs-extra')
const globalRemove = require('./globalRemove.json')
const remove = [
  'trex.zip',
  'wildrig.zip',
  'BOINC-Win32.zip',
  'loading.gif'
]
const finalRemove = globalRemove.concat(remove)

function init(baseDir){
  for (data of finalRemove){
    fs.removeSync(baseDir + data)
  }

}

module.exports = init

// exec(`
// xattr -cr * && 
// rm out/Boid-darwin-x64/Boid.app/Contents/Resources/app/node_modules/electron-sudo/dist/bin/applet.app/LICENSE && 
// rm /Users/boid/Dev/boidDev/electoboid/out/Boid-darwin-x64/Boid.app/Contents/Resources/app/node_modules/electron-sudo/src/bin/applet.app/LICENSE && electron-osx-sign out/Boid-darwin-x64/Boid.app/
// `)