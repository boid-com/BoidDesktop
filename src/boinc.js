import { ipcMain } from 'electron'
const os = require('os')
const thisPlatform = os.platform()
var unzip = require('decompress-zip')
var fs = require('fs-extra')
const isDev = require('electron-is-dev')
var path = require('path')
require('fix-path')()
const spawn = require('child_process').spawn
const ax = require('axios')
const parseXML = require('xml-to-json-promise').xmlFileToJSON
const { exec } = require('child-process-promise')
const jsonfile = require('jsonfile')
import { app } from 'electron'
const cfg = require('electron-settings')


if (isDev) var HOMEPATH = path.join(app.getPath('home'), '.BoidDev')
else var HOMEPATH = path.join(app.getPath('home'), '.Boid')
var BOINCPATH = path.join(HOMEPATH, 'BOINC')
var RESOURCEDIR = path.join(__dirname, '../')
function ec(error){
  console.error(error)
  ipcMain.emit('error', error)
}

var boinc = {}

boinc.init = async () => {
  try {
    console.log('boinc init')
    
  } catch (error) {
    ec(error)
  }
}
boinc.state = {} 
boinc.state.getAll = async () => {
  const stateFile = path.join(BOINCPATH, './client_state.xml')
  try {
    var exists = await fs.exists(stateFile)
    if (!exists) throw('state file does not exist')
    const parsedState = parseXML(stateFile)
    // console.log(JSON.stringify(parsedState))
    return parsedState
  } catch (error) { boinc.state.clear(), ec(error) }
}

boinc.state.getDevice = async () => {
  try {
    const fullState = await boinc.state.getAll()
    if (!fullState) throw('null state')
    var state = fullState.client_state.host_info[0]
    const thisDevice = {
      name: state.domain_name[0],
      cpid: state.host_cpid[0],
      os: state.os_version[0],
    }
    try {
      const project = fullState.client_state.project[0]
      if (!project) return thisDevice
      thisDevice.wcgid = project.hostid[0]
    } catch (error) {ec(error)}
    return thisDevice
  } catch (error) { ec(error) }
}

boinc.state.clear = async () => {
  const stateFile = path.join(BOINCPATH, './client_state.xml')
  try {
    var exists = await fs.exists(stateFile)
    if (exists) await fs.remove(stateFile)
    return true
  } catch (error) {
    ec(error)
  }
}

module.exports = boinc