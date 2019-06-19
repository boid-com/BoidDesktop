const fs = require('fs-extra')
const os = require('os')
const exec = require('child_process').execSync

fs.emptyDirSync('../TEMP')
fs.copySync('.','../TEMP')
console.log(exec('node-prune ../TEMP').toString())
if (os.platform() === 'win32') require('./prepMake-Win')('../TEMP/')
else if (os.platform() === 'darwin') require('./prepMake-Mac')('../TEMP/')