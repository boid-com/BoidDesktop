const fs = require('fs-extra')
fs.removeSync('./out')
fs.copySync('../TEMP/out','./out') 
fs.removeSync('../TEMP')
