import {
  ipcMain,
  ipcRenderer
} from 'electron'
const os = require( 'os' )
var unzip = require( 'decompress-zip' )
var fs = require( 'fs-extra' )
const isDev = require( 'electron-is-dev' )
var path = require( 'path' )
require( 'fix-path' )()
const spawn = require( 'child_process' ).spawn
const ax = require( 'axios' )
const parseXML = require( 'xml-to-json-promise' ).xmlFileToJSON
const {exec} = require( 'child-process-promise' )
const jsonfile = require( 'jsonfile' )
import { app } from 'electron'
const cfg = require( 'electron-settings' )

if (isDev) var HOMEPATH = path.join(app.getPath('home'), '.BoidDev')
else var HOMEPATH = path.join(app.getPath('home'), '.Boid')
var CPUPATH
var BOINCPATHRAW = path.join(HOMEPATH, 'BOINC')
var BOINCPATH = dir(BOINCPATHRAW)
var RESOURCEDIR = path.join(__dirname, '../')

var cpu = {}
var boinc = {}

boinc.migrateLegacy = async () => {
const boincDir = 
}

boinc.state = {
  async read(){
    try {
      var exists = await fs.exists(path.join(, 'client_state.xml'))
      if (!exists) return false
      var stateXML = await fs.readFile(path.join(, 'client_state.xml'))

    } catch (error) {
      console.error(error)
    }
  }
}

cpu.boinc = boinc
module.exports = cpu