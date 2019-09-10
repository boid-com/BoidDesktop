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
const log = require('electron-log')
const psList = require('ps-list')  //<--- Include the nodeJS module for checking if a process exists.
const getos = require('getos')

const BOINCPROJECTNAME="http://www.worldcommunitygrid.org/"       //<--- That is the name of the project we are participating. We must use this as a reference for the start/suspend/stop tasks.
const BOINCSUSPENDCMD="project " + BOINCPROJECTNAME + " suspend"  //<--- That is the BOINCCMD command to suspend temporarily the project.
const BOINCRESUMECMD="project " + BOINCPROJECTNAME + " resume"    //<--- That is the BOINCCMD command to resume the project.

var HOMEPATH = path.join(app.getPath('home'), '.Boid')
// if (isDev) var HOMEPATH = path.join(app.getPath('home'), '.BoidDev')
// else var HOMEPATH = path.join(app.getPath('home'), '.Boid')
var BOINCPATH = path.join(HOMEPATH, 'BOINC')
if (isDev) var RESOURCEDIR = path.join(__dirname, '../')
else var RESOURCEDIR = path.join(__dirname, '../../')

async function sleep(){return new Promise(resolve => setTimeout(resolve,3000))}

function ec(error){
  log.error(error)
  if (ipc.ipc) boinc.send('error',{date:Date.now(),error})
  else ipcMain.emit('error',{date:Date.now(),error})
}

var spawnConfig = {
  cwd: BOINCPATH,
  name: 'Boid Secure Sandbox'
}

async function setupIPC(funcName) {
  try {
    const channel = 'boinc.' + funcName
    ipcMain.on(channel, async (event, arg) => {
      ipc.init(event.sender,'boinc')
      log.info('IPC Event Received:', channel + '()')
      const emitChannel = channel.split('boinc.')[1]
      boinc.send(emitChannel, await (eval(channel)(arg)))
    })
  } catch (error) {
    log.error(error)
  }
}

var boinc = {
  eventsRegistered: false,
  initializing: false,
  shouldBeRunning: false,
  thisPlatform: thisPlatform
}

boinc.killExisting = async () => {
  try {
    await boinc.stop()
    if (boinc.process) {
      process.kill(-boinc.process.pid)
      boinc.process.kill()
    }
    if (thisPlatform === 'win32') await exec('Taskkill /IM boinc.exe /F')
    else await exec('pkill -9 boinc')
  } catch (error) {
    log.error(error)
    log.info('No Existing processes')
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

boinc.reset = async () => {
  await boinc.stop()
  await fs.remove(path.join(BOINCPATH, 'remote_hosts.cfg'))
  app.relaunch()
  app.exit()
}

boinc.openDirectory = async () => {
  shell.openItem(BOINCPATH)
}

/*
 * With this method we detect if BOINC client is running.
 */
boinc.detectIfRunning = async () => {
  var boincProcessFound=false
  await psList().then(processData => {
    for(var i=0, len=processData.length; i<len; i++){
      if((processData[i].name==='boinc.exe' && thisPlatform==='win32')||(processData[i].name==='boinc' && thisPlatform!=='win32')){
        boincProcessFound=!boincProcessFound
        break
      }
    }
  });

  return boincProcessFound
}

boinc.spawnProcess = async () =>{
  //if (thisPlatform === 'win32') exe = 'boinc.exe'
  //else exe = './boinc'

  var exe = (thisPlatform === 'win32' ? 'boinc.exe' : (thisPlatform === 'linux' ? 'boinc' : './boinc'))  //<--- Use the more elegant ternary expression.
  var params = ['-dir', BOINCPATH, '-no_gpus', '-allow_remote_gui_rpc','-suppress_net_info']
  if (thisPlatform === 'win32') params.push('-allow_multiple_clients')

  boinc.process = spawn(exe, params, {
    silent: false,
    cwd: BOINCPATH, //<--- Leave it untouched for Linux clients (???)
    shell: false,
    detached: true,
    env: null,
  })
}

boinc.start = async (data) => {
  /* Check for a valid installation of BOINC platform. If there is none we are trying to install it. Recall ourselves after installing. */
  try {
    const checkInstall = await boinc.checkInstalled()
    if(!checkInstall) {
      const installed = await boinc.install()
      if (installed) return boinc.start()
      else return boinc.send('message', 'Unable to start due to install error.')
    }
  } catch (error) {
    ec(error)
    boinc.stop()
  }

  /* That is the actual 'start' process part of the source code. */
  //await boinc.killExisting()  //<--- We won't be killing the existing process if it's running. We are just going to be checking if running and then start it.
  //<--- Find of a way to check if the BOINC client is running...if not we must start it 'safely'...

  const checkIfRunning = await boinc.detectIfRunning()

  boinc.initializing = false
  boinc.shouldBeRunning = true
  boinc.send('status', 'Starting...')
  try {
    cfg.set('state.cpu.toggle', true)
    //if(boinc.process && boinc.process.killed === false) return boinc.process.kill()   //<--- We don't need to kill the BOINC process anymore. If running we will be autostarting.
   
    if(!checkIfRunning)           //<--- If BOINC client is not running then we need to start it manually.
      await boinc.spawnProcess()

    setTimeout(()=>boinc.send('started'),1000)

    await boinc.cmd(BOINCRESUMECMD)

    boinc.process.stdout.on('data', data => ipc.send('log', data.toString()))
    boinc.process.stderr.on('data', data => ipc.send('error', data.toString()))

    boinc.process.on('exit', (code, signal) => {
      log.info('detected close code:', code, signal)
      log.info('should be running', boinc.shouldBeRunning)
      //Check if the 'process' is a valid object.
      if(boinc.process){
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
      }
    })
  }catch(error){if(ec)ec(error)}
}

boinc.stop = async (data) => {
  cfg.set('state.cpu.toggle', false)
  if(!boinc.process) return boinc.send('toggle', false)
  // boinc.process.kill()
  //await boinc.cmd('quit')         //<--- We cannot kill the BOINC client. This line have been substituted by the one that is following.
  await boinc.cmd(BOINCSUSPENDCMD)  //<--- The project gets suspended only.
  await sleep(5000)
  boinc.shouldBeRunning = false
  boinc.send('status', 'Stopped')   //<--- We must update the client with the new status for 'Stopped'.
  boinc.send('Stopped')
  return sleep(5000)
}

boinc.unzip = async () => {
  var unzipper = new unzip(path.join(RESOURCEDIR, 'BOINC-Win32.zip'))
  return new Promise(async (resolve, reject) => {
    log.info('STARTING TO UNZIP')
    unzipper.on('error', function (err) {
      log.error('Caught an error', err)
      reject(err)
    })

    unzipper.on('extract', async function (log) {
      await boinc.prefs.init()
      resolve(log)
    })

    unzipper.on('progress', function (fileIndex, fileCount) {
      log.info('Extracted file ' + (fileIndex + 1) + ' of ' + fileCount)
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
    log.info('BOINC.CMD',cmd)
    const result = (await exec(exe + ` --host localhost --passwd ` + pass + ' --' + cmd, { cwd: BOINCPATH })).stdout
    log.info(result)
    return result
  }catch(error){if(ec)ec(error)}
}

boinc.detectAndInstallLinux = async () => {
  getos(function(e, os){
    return boinc.installLinux(os)
  })
}

/* Linux Installation has been cut-off from the main installer in order to be much more maintenable */
boinc.installLinux = async (osInfo) => {
  var cmd=""

  /* Begin the installation by installing the essential libraries for the BOINC client */
  if(osInfo.dist.toUpperCase().includes("UBUNTU")){
    cmd= 'apt-get install boinc'
  }

  return new Promise(async function (resolve, reject) {
    sudo.exec(cmd, {name: 'Boid Install BOINC Client'}, async function (err, stdout, stderr) {
      if (err) reject(err)
      if (stdout) {
        log.info(stdout)
        if (stdout.indexOf('done') > -1) {
          log.info('BOINC INSTALLATION FINISHED')
          boinc.intializing = false
          await boinc.prefs.init()
          resolve(stdout)
        }
      }
      if (stderr) {
        reject(stderr)
      }
    })
  })  
}

boinc.install = async () => {
  try {
    if (boinc.initializing) return
    boinc.initializing = true
    await boinc.stop()
    await fs.outputFile(path.join(BOINCPATH, 'remote_hosts.cfg'), 'localhost').catch(ec)

    if (thisPlatform === 'win32'){
      /* Windows Installation of BOINC client path */
      return boinc.unzip()
    }else if(thisPlatform === 'linux'){
      /* Linux Installation of BOINC client path (For the time being just repeat/modify the Mac source code.) */
      return boinc.detectAndInstallLinux()
    }else{
      /* Mac Installation of BOINC client path */
      await fs.ensureDir(BOINCPATH)
      var cmd0 = 'rm -rf ' + BOINCPATH
      var cmd1 = 'unzip -o ' + path.join(RESOURCEDIR, 'BOINC.zip') + ' -d ' + HOMEPATH
      var cmd2 = 'cd ' + BOINCPATH
      var cmd3 = 'sh ' + path.join(BOINCPATH, './Mac_SA_Secure.sh')
      var cmd4 = 'dscl . -merge /groups/boinc_master GroupMembership $USER'
      var cmd5 = 'dscl . -merge /groups/boinc_project GroupMembership $USER'
      var cmd = 'sh -c "'+ cmd0 + ' && ' + cmd1 + ' && ' + cmd2 + ' && ' + cmd3 + ' && ' + cmd4 + ' && ' + cmd5 + '&& echo done' + '"'
      log.info(cmd)
      return new Promise(async function (resolve, reject) {
        sudo.exec(cmd, spawnConfig, async function (err, stdout, stderr) {
          if (err) reject(err)
          if (stdout) {
            log.info(stdout)
            if (stdout.indexOf('done') > -1) {
              log.info('SANDBOX FINISHED')
              boinc.intializing = false
              await boinc.prefs.init()
              resolve(stdout)
            }
          }
          if (stderr) {
            // log.info(stderr)
            reject(stderr)
          }
        })
      })
    }
  }catch(error){if(ec)ec(error)}

  
}
boinc.prefs = {
  default: { run_if_user_active: '1', cpu_usage_limit: '100.0', max_ncpus_pct: '100', idle_time_to_run: '3.0', ram_max_used_busy_pct: '50.0', ram_max_used_idle_pct: '75.0',run_on_batteries:'1',run_if_user_active:'1' },
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
      log.error(error)
       return boinc.prefs.init(boinc.prefs.read)
     } 
  } 
}

boinc.config = {
  file: path.join(BOINCPATH, 'boid-cpu-config.json'),
  async verify () {
    await fs.ensureDir(BOINCPATH)
    const result = await fs.exists(boinc.config.file).catch(ec)
    log.info('verify config file',result)
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
      log.info('read config', boinc.config.file)
      var config = await fs.readJson(boinc.config.file)
      if (Object.keys(config).length == 0) throw('Config missing')
      return config
    } catch (error) {
      log.info('reset config')
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
      if(!fullState) return null
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