const fs = require('fs-extra')
const globalRemove = require('./globalRemove.json')
const remove = [
  "logo.icns",
  "Mac_SA_Secure.sh",
]

const finalRemove = globalRemove.concat(remove)

function init(baseDir){
  for (data of finalRemove){
    fs.removeSync(baseDir + data)
  }

}

module.exports = init
