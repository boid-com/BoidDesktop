const fs = require('fs-extra')

const remove = [
  ".vscode",
  ".gitignore",
  ".git",
  ".DS_Store",
  "logo.icns",
  "Mac_SA_Secure.sh",
  "BOINC.zip",
  "util",
  "out"
]

function doit(baseDir){
  for (data of remove){
    fs.removeSync(baseDir + data)
  }

}

module.exports = doit
