const exec = require('child_Process').execSync

exec(`
xattr -cr * && 
rm out/Boid-darwin-x64/Boid.app/Contents/Resources/app/node_modules/electron-sudo/dist/bin/applet.app/LICENSE && 
rm /Users/boid/Dev/boidDev/electoboid/out/Boid-darwin-x64/Boid.app/Contents/Resources/app/node_modules/electron-sudo/src/bin/applet.app/LICENSE && electron-osx-sign out/Boid-darwin-x64/Boid.app/
`)