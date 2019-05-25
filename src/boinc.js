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
const xml2js = require('xml2js')
var builder = new xml2js.Builder({ headless: true })
import { app } from 'electron'
import { write } from 'fs';
const cfg = require('electron-settings')
const ipc = require('./ipcWrapper')
var sudo = require('sudo-prompt')


if (isDev) var HOMEPATH = path.join(app.getPath('home'), '.BoidDev')
else var HOMEPATH = path.join(app.getPath('home'), '.Boid')
var BOINCPATH = path.join(HOMEPATH, 'BOINC')
var RESOURCEDIR = path.join(__dirname, '../')

function ec(error){
  console.error(error)
  ipcMain.emit('error', error)
}

var spawnConfig = {
  cwd: BOINCPATH,
  name: 'Boid Secure Sandbox'
} 

var boinc = {
  eventsRegistered:false,
  initializing:false,
  shouldBeRunning:false
}
boinc.send = (channel,data,data2) => ipc.send(channel,data,data2)
boinc.on = (channel,data) => ipc.on(channel,data)
boinc.init = async (event) => {
  try {
    ipc.init(event.sender,'boinc')
    if (boinc.eventsRegistered) return
    boinc.on('start',boinc.start)
    boinc.on('stop',boinc.stop)
    boinc.on('cmd',boinc.cmd)
    boinc.eventsRegistered = true
  } catch (error) {
    ec(error)
  }
}

boinc.start = async (data) => {
  console.log('start BOINC')
  const checkInstall = await boinc.checkInstalled()
  console.log(checkInstall)
  if(!checkInstall) {
    const installed = await boinc.install()
    if (installed) return boinc.start()
    else return boinc.send('message', 'Unable to start due to install error.')
  }
  
  boinc.initializing = false
  boinc.shouldBeRunning = true
  boinc.send('status', 'starting...')
  try {
    cfg.set('state.cpu.toggle', true)
    if(boinc.process && boinc.process.killed === false) return boinc.process.kill()
    var exe
    if (thisPlatform === 'win32') exe = 'boinc.exe'
    else exe = './boinc'
    boinc.process = spawn(exe, ['-dir', BOINCPATH, '-allow_multiple_clients', '-no_gpus', '-allow_remote_gui_rpc'], {
      silent: false,
      cwd: BOINCPATH,
      shell: false,
      detached: false,
      env: null
    })
    boinc.process.stdout.on('data', data => ipc.send('log', data.toString()))
    boinc.process.stderr.on('data', data => ipc.send('error', data.toString()))
    boinc.process.on('exit', (code, signal) => {
      console.log('detected close code:', code, signal)
      console.log('should be running', boinc.shouldBeRunning)
      boinc.process.removeAllListeners()
      boinc.process = null
      if(boinc.shouldBeRunning) {
        boinc.send('message', 'The Miner stopped and Boid is restarting it')
        boinc.start()
      } else {
        boinc.send('message', 'The Miner was stopped')
        boinc.send('status', 'Stopped')
        boinc.send('toggle', false)
        cfg.set('state.cpu.toggle', false)
      }
    })
  }catch(error){if(ec)ec(error)}

  }
boinc.stop = async (data) => {
  boinc.shouldBeRunning = false
  cfg.set('state.cpu.toggle', false)
  if(!boinc.process) return gpu.emit('toggle', false)
  boinc.process.kill()
  // ipc.send('toggle', false)
  console.log('finished stopping')
  return 'finished stopping'
}

boinc.unzip = async () => {
  var unzipper = new unzip(path.join(RESOURCEDIR, 'BOINC-Win32.zip'))
  return new Promise((resolve, reject) => {
    console.log('STARTING TO UNZIP')
    unzipper.on('error', function (err) {
      console.error('Caught an error', err)
      reject(err)
    })

    unzipper.on('extract', function (log) {
      // console.log('Finished extracting', log)
      resolve(log)
    })

    unzipper.on('progress', function (fileIndex, fileCount) {
      console.log('Extracted file ' + (fileIndex + 1) + ' of ' + fileCount)
    })

    unzipper.extract({
      path: BOINCPATHRAW,
      filter: function (file) {
        return file.type !== 'SymbolicLink'
      }
    })
  })
}

boinc.checkInstalled = async () => {
  const exists = await fs.exists(path.join(BOINCPATH, 'remote_hosts.cfg')).catch(ec)
  if (!exists) return false
  else return true
}

boinc.install = async () => {
  if (boinc.initializing) return
  boinc.initializing = true
  await boinc.config.init()
  await fs.outputFile(path.join(BOINCPATH, 'remote_hosts.cfg'), 'localhost').catch(ec)
  if (thisPlatform === 'win32') return boinc.unzip()
  await fs.ensureDir(BOINCPATH)
  var cmd0 = 'rm -rf ' + BOINCPATH
  var cmd1 = 'unzip -o ' + path.join(RESOURCEDIR, 'BOINC.zip') + ' -d ' + HOMEPATH
  var cmd2 = 'cd ' + BOINCPATH
  var cmd3 = 'sh ' + path.join(BOINCPATH, './Mac_SA_Secure.sh')
  var cmd4 = 'dscl . -merge /groups/boinc_master GroupMembership $USER'
  var cmd5 = 'dscl . -merge /groups/boinc_project GroupMembership $USER'
  var cmd = 'sh -c "'+ cmd0 + ' && ' + cmd1 + ' && ' + cmd2 + ' && ' + cmd3 + ' && ' + cmd4 + ' && ' + cmd5 + '&& echo done' + '"'
  console.log(cmd)
  return new Promise(async function (resolve, reject) {
    sudo.exec(cmd, spawnConfig, function (err, stdout, stderr) {
      if (err) reject(err)
      if (stdout) {
        console.log(stdout)
        if (stdout.indexOf('done') > -1) {
          console.log('SANDBOX FINISHED')
          boinc.intializing = false
          resolve(stdout)
        }
      }
      if (stderr) {
        // console.log(stderr)
        reject(stderr)
      }
    })
  })
}
boinc.config = {
  default: { run_if_user_active: '1', cpu_usage_limit: '80.0', max_ncpus_pct: '100', idle_time_to_run: '3.0', ram_max_used_busy_pct: '50.0', ram_max_used_idle_pct: '75.0' },
  async init() {
    return boinc.config.write(boinc.config.default)
  },
  async write(config) {
    return fs.writeFile(path.join(BOINCPATH, 'global_prefs_override.xml'), builder.buildObject({global_preferences:config}))
  }
}

boinc.state = {
  async getAll () {
    const stateFile = path.join(BOINCPATH, './client_state.xml')
    try {
      var exists = await fs.exists(stateFile)
      if(!exists) throw ('state file does not exist')
      const parsedState = parseXML(stateFile)
      // console.log(JSON.stringify(parsedState))
      return parsedState
    } catch (error) { this.clear(), ec(error) }
  },
  async getDevice () {
    try {
      const fullState = await this.getAll()
      if(!fullState) throw ('null state')
      var state = fullState.client_state.host_info[0]
      const thisDevice = {
        name: state.domain_name[0],
        cpid: state.host_cpid[0],
        os: state.os_version[0],
      }
      try {
        const project = fullState.client_state.project[0]
        if(!project) return thisDevice
        thisDevice.wcgid = project.hostid[0]
      } catch (error) { ec(error) }
      return thisDevice
    } catch (error) { ec(error) }
  },
  async clear () {
    const stateFile = path.join(BOINCPATH, './client_state.xml')
    try {
      var exists = await fs.exists(stateFile)
      if(exists) await fs.remove(stateFile)
      return true
    } catch (error) {
      ec(error)
    }
  }
}

module.exports = boinc