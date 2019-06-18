const fs = require('fs-extra')

const remove = [
  "out/Boid-win32-x64/resources/app/.vscode",
  "out/Boid-win32-x64/resources/app/.gitignore",
  "out/Boid-win32-x64/resources/app/.git",
  "out/Boid-win32-x64/resources/app/logo.icns",
  "out/Boid-win32-x64/resources/app/Mac_SA_Secure.sh",
  "out/Boid-win32-x64/resources/app/package.json",
  "out/Boid-win32-x64/resources/app/BOINC.zip",
  "out/Boid-win32-x64/resources/app/util"
]

for (data of remove){
  fs.removeSync(data)
}
