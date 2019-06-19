const fs = require('fs-extra')
try {fs.removeSync('./out')} catch (error) {console.error(error)}
fs.copySync('../TEMP/out','./out') 
fs.removeSync('../TEMP')
