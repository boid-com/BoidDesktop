const { ipcMain, shell, app} = require('electron')
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
const xml2js = require('xml2js')
var builder = new xml2js.Builder({ headless: true })
const cfg = require('electron-settings')
const ipc = require('./ipcWrapper')()
var sudo = require('sudo-prompt')

var HOMEPATH = path.join(app.getPath('home'), '.Boid')
// if (isDev) var HOMEPATH = path.join(app.getPath('home'), '.BoidDev')
// else var HOMEPATH = path.join(app.getPath('home'), '.Boid')
var BOINCPATH = path.join(HOMEPATH, 'BOINC')
if (isDev) var RESOURCEDIR = path.join(__dirname, '../')
else var RESOURCEDIR = path.join(__dirname, '../../')

async function sleep(){return new Promise(resolve => setTimeout(resolve,3000))}
function ec(error){
  console.error(error)
  boinc.send('error',{date:Date.now(),error})
}

var spawnConfig = {
  cwd: BOINCPATH,
  name: 'Boid Secure Sandbox'
} 

async function setupIPC(funcName) {
  try {
    console.log(funcName)
    const channel = 'boinc.' + funcName
    console.log(channel)
  
    ipcMain.on(channel, async (event, arg) => {
      ipc.init(event.sender,'boinc')
      console.log('IPC Event Received:', channel + '()')
      const emitChannel = channel.split('boinc.')[1]
      boinc.send(emitChannel, await (eval(channel)(arg)))
    })
  } catch (error) {
    console.error(error)
  }

}


var boinc = {
  eventsRegistered:false,
  initializing:false,
  shouldBeRunning:false
}
boinc.killExisting = async () => {
  try {
    await boinc.stop()
    if ( boinc.process) {
      process.kill(-boinc.process.pid)
      boinc.process.kill()
    }
    if (thisPlatform === 'win32') await exec('Taskkill /IM boinc.exe /F')
    else await exec('pkill -9 boinc')
    console.log('removed existing')
  } catch (error) {
    console.log('No Existing processes')
  }
}

boinc.send = (channel,data,data2) => ipc.send(channel,data,data2)
boinc.on = (channel,data) => ipc.on(channel,data)
boinc.init = async (event) => {
  try {
    ipc.init(event.sender,'boinc')
    if (boinc.eventsRegistered) return
    boinc.on('cmd',boinc.cmd)
    boinc.on('state.getProject',boinc.state.getProject)
    boinc.on('state.getAll',boinc.state.getAll)
    boinc.on('getUI',boinc.getUI)
    // boinc.on('prefs.read',async ()=>boinc.send('prefs.read',async ()=> await boinc.prefs.read()))
    setupIPC('start')
    setupIPC('stop')
    setupIPC('prefs.read')
    setupIPC('prefs.write')
    setupIPC('config.read')
    setupIPC('config.write')
    setupIPC('config.init')
    setupIPC('reset')
    setupIPC('openDirectory')
    setupIPC('state.getUI')
    boinc.eventsRegistered = true
  } catch (error) {
    ec(error)
  }
}

boinc.getUI = async () => {
console.log('get UI')
}

boinc.reset = async () => {
  await boinc.stop()
  await fs.remove(path.join(BOINCPATH, 'remote_hosts.cfg'))
  app.relaunch()
  app.exit()
}
boinc.openDirectory = async () => {
  shell.openItem(BOINCPATH)
}

boinc.start = async (data) => {
  try {
    console.log('start BOINC')
    const checkInstall = await boinc.checkInstalled()
    console.log(checkInstall)
    if(!checkInstall) {
      const installed = await boinc.install()
      if (installed) return boinc.start()
      else return boinc.send('message', 'Unable to start due to install error.')
    }
  } catch (error) {
    ec(error)
    boinc.stop()
  }
  await boinc.killExisting()
  boinc.initializing = false
  boinc.shouldBeRunning = true
  boinc.send('status', 'Starting...')
  try {
    cfg.set('state.cpu.toggle', true)
    if(boinc.process && boinc.process.killed === false) return boinc.process.kill()
    var exe
    if (thisPlatform === 'win32') exe = 'boinc.exe'
    else exe = './boinc'
    boinc.process = spawn(exe, ['-dir', BOINCPATH, '-no_gpus', '-allow_remote_gui_rpc','-suppress_net_info'], {
      silent: false,
      cwd: BOINCPATH,
      shell: false,
      detached: true,
      env: null,
    })
    setTimeout(()=>boinc.send('started'),1000)
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
        boinc.send('message', 'BOINC was stopped')
        boinc.send('status', 'Stopped')
        boinc.send('toggle', false)
        cfg.set('state.cpu.toggle', false)
      }
    })
  }catch(error){if(ec)ec(error)}

  }
boinc.stop = async (data) => {
  cfg.set('state.cpu.toggle', false)
  if(!boinc.process) return boinc.send('toggle', false)
  // boinc.process.kill()
  await boinc.cmd('quit')
  await sleep(5000)
  boinc.shouldBeRunning = false
  return sleep(5000)
}

boinc.unzip = async () => {
  var unzipper = new unzip(path.join(RESOURCEDIR, 'BOINC-Win32.zip'))
  return new Promise(async (resolve, reject) => {
    console.log('STARTING TO UNZIP')
    unzipper.on('error', function (err) {
      console.error('Caught an error', err)
      reject(err)
    })

    unzipper.on('extract', async function (log) {
      await boinc.prefs.init()
      resolve(log)
    })

    unzipper.on('progress', function (fileIndex, fileCount) {
      console.log('Extracted file ' + (fileIndex + 1) + ' of ' + fileCount)
    })

    unzipper.extract({
      path: BOINCPATH,
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

boinc.cmd = async (cmd) => {
  try {
    if (!boinc.shouldBeRunning) return null
    var pass = await fs.readFile(path.join(BOINCPATH, 'gui_rpc_auth.cfg'), 'utf8')
    var exe
    if (thisPlatform === "win32") exe = 'boinccmd'
    else exe = './boinccmd'
    console.log('BOINC.CMD',cmd)
    const result = (await exec(exe + ` --host localhost --passwd ` + pass + ' --' + cmd, { cwd: BOINCPATH })).stdout
    console.log(result)
    return result
  }catch(error){if(ec)ec(error)}
}

boinc.install = async () => {
  try {
    if (boinc.initializing) return
    boinc.initializing = true
    await boinc.stop()
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
      sudo.exec(cmd, spawnConfig, async function (err, stdout, stderr) {
        if (err) reject(err)
        if (stdout) {
          console.log(stdout)
          if (stdout.indexOf('done') > -1) {
            console.log('SANDBOX FINISHED')
            boinc.intializing = false
            await boinc.prefs.init()
            resolve(stdout)
          }
        }
        if (stderr) {
          // console.log(stderr)
          reject(stderr)
        }
      })
    })
  }catch(error){if(ec)ec(error)}

  
}
boinc.prefs = {
  default: { run_if_user_active: '1', cpu_usage_limit: '80.0', max_ncpus_pct: '100', idle_time_to_run: '3.0', ram_max_used_busy_pct: '50.0', ram_max_used_idle_pct: '75.0',run_on_batteries:'1',run_if_user_active:'1' },
  async init(cb) {
    await boinc.prefs.write(boinc.prefs.default)
    if (cb) return cb()
  },
  async write(prefs) {
    return fs.outputFile(path.join(BOINCPATH, 'global_prefs_override.xml'), builder.buildObject({global_preferences:prefs}))
  },
  async read(){
     try {
      const prefs = (await parseXML(path.join(BOINCPATH, 'global_prefs_override.xml'))).global_preferences
      return prefs
    } catch (error) {
      console.error(error)
       return boinc.prefs.init(boinc.prefs.read)
     } 
  } 
}

boinc.config = {
  file: path.join(BOINCPATH, 'boid-cpu-config.json'),
  async verify () {
    await fs.ensureDir(BOINCPATH)
    const result = await fs.exists(boinc.config.file).catch(ec)
    console.log('verify config file',result)
    if(!result) boinc.send('status', 'cpu config missing')
    return result
  },
  async init (config) {
    try {
      if(!config) throw ('config missing')
      const exists = await boinc.config.verify()
      if(!exists) {
        boinc.send('status', 'initializing')
        await fs.writeJson(boinc.config.file, config)
      }
      const newConf = await boinc.config.read()
      boinc.send('config.read', newConf)
      return newConf
    } catch (error) {return ec(error)}
  },
  async read () {
    try {
      console.log('read config', boinc.config.file)
      var config = await fs.readJson(boinc.config.file)
      if (Object.keys(config).length == 0) throw('Config missing')
      return config
    } catch (error) {
      console.log('reset config')
      await fs.remove(boinc.config.file)
      await boinc.config.write({autoStart:false})
      ec(error)
      return {autoStart:false}
    }
  },
  async write (config) {
    try {
      await fs.writeJson(boinc.config.file, config)
      boinc.send('config.read', await boinc.config.read())
    } catch (error) {
      ec(error)
    }
  }
}

boinc.state = {
  async getAll () {
    const stateFile = path.join(BOINCPATH, './client_state.xml')
    try {
      var exists = await fs.exists(stateFile)
      if(!exists) throw ('state file does not exist')
      const parsedState = parseXML(stateFile)
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
  async getProject () {
    try {
      const fullState = await boinc.state.getAll()
      if(!fullState) throw ('null state')
      const project = fullState.client_state.project[0]
      boinc.send('state.getProject',project)
      return project
    } catch (error) { ec(error), boinc.send('state.getProject',false)}
  },
  async getUI(){
    var stats = {}
    try {
      const fullState = (await boinc.state.getAll()).client_state
      if(!fullState) throw ('null state')
      stats.uptime = parseFloat(fullState.time_stats[0].total_duration)
      stats.results = fullState.result
      stats.workUnits = fullState.active_task_set[0].active_task
      return stats
    } catch (error) { ec(error)}
    return stats
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