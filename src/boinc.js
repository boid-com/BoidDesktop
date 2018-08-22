const spawn = require('child_process').spawn
const exec = require('child_process').exec
const execP = require('child-process-promise').exec
const isDev = require('electron-is-dev')
const fixPath = require('fix-path')
var unzip = require('decompress-zip')
var weakKey = '1061556_a0c611b081f8692b7ef0c11d39e6105c'
var fs = require('fs-extra')
var xml2js = require('xml2js')
var parser = new xml2js.Parser()
var configParser = new xml2js.Parser({explicitArray:false})
var builder = new xml2js.Builder({headless:true})
var path = require('path')
var needsProject = false
var attachingProject = false
fixPath()
var thisPlatform = process.platform
const EventEmitter = require('events')
var events = new EventEmitter()
var isRoot = process.getuid && process.getuid() === 0
var sudo = require('sudo-prompt')
var options = {
  name: 'Boid Secure Sandbox'
  // icns: '/Applications/Electron.app/Contents/Resources/Electron.icns'
}
import { app } from 'electron'

if (isDev) var HOMEPATHRAW = path.join(app.getPath('home'), '.BoidDev')
else var HOMEPATHRAW = path.join(app.getPath('home'), '.Boid')
var HOMEPATH = dir(HOMEPATHRAW)
var BOINCPATHRAW = path.join(HOMEPATHRAW, 'BOINC')
var BOINCPATH = dir(BOINCPATHRAW)
var RESOURCEDIR = path.join(__dirname, '../')

var global_preferences = {run_if_user_active:'1',cpu_usage_limit:'80.0',max_ncpus_pct:'100',idle_time_to_run:'3.0',ram_max_used_busy_pct:'50.0',ram_max_used_idle_pct:'75.0'}
console.log('BOINCPATH:', BOINCPATHRAW)

function ec(err){ //Error Catcher
  console.error(err)
  b.events.emit('error',err)
}

var spawnConfig = {
  cwd: BOINCPATH,
  name: 'Boid Secure Sandbox'
}

function dir(dir) {
  return dir.replace(/(["\s'$`\\])/g, '\\ ')
}

function setupBoincDListeners() {
  if (!b.boincD) return
  b.boincD.stdout.on('data', async (data) => {
    console.log(`boincD: ${data}`)
    if (data.indexOf('Initialization completed') > -1) {
      // boincDInitialized()
    } else if (data.indexOf('This computer is not') > -1) {
      needsProject = true
    } else if (data.indexOf('File ownership or permissions are set') > -1) {
      b.cmd('stop')
      ec('Permissions are not set correctly')
      setTimeout(() => {
        b.init(true)
      }, 2000)
      b.events.emit('showWindow')
    } else if (data.indexOf('Another instance of BOINC is running')> -1){
      b.boincD = null
      b.start()
    } else if (data.indexOf('Suspending computation - on batteries') > -1) {
      b.events.emit('suspended','on batteries')
    } else if (data.indexOf('Suspending computation - computer is in use') > -1) {
      b.events.emit('suspended','computer is in use')
    } else if (data.indexOf('Resuming network activity') > -1 || data.indexOf('Resuming computation') > -1) {
      b.events.emit('suspended',false)
    }
    
  })
  b.boincD.stderr.on('data', (data) => {
    ec(data)
  })

  b.boincD.on('close', (code) => {
    console.log(`boincD exited with code ${code}`)
    b.boincD = null
    // b.checkExisting()
  })
}
async function clearLocks() {
  if (b.initializing) return
  var slots = path.join(BOINCPATH, 'slots')
  try {
    var folders = await fs.readdir(slots)
    folders = folders.filter((el) => {
      return el != '.DS_Store'
    })
    folders.forEach(async (el) => {
      console.log(path.join(BOINCPATH, 'slots', el, 'boinc_lockfile'))
      var result = await fs.remove(path.join(slots, el, 'boinc_lockfile')).catch(console.log)
      console.log(result)
    })
  } catch (err) {
    // ec(err,false)
    console.error('SLOTS ERR', err)
  }
}
var addUserProject = async () => {
  console.log("ADDING USER PROJECT")
  var userProjectURL = 'http://www.worldcommunitygrid.org/'
  var addProject = 'project_attach ' + userProjectURL + ' ' + weakKey
  b.cmd(addProject)
}

var boincDInitialized = async () => {
  console.log("BOINC IS INITALIZED")
  if (needsProject) await addUserProject().catch(ec)
  await updateClientState().catch(ec)
  console.log('cpid', b.device)
}

var updateClientState = async () => {
  var exists = await fs.exists(path.join(b.dataDir(), './client_state.xml')).catch(ec)
  if (!exists) return null
  else
    try {
      var stateXML = await fs.readFile(path.join(b.dataDir(), 'client_state.xml'))
    } catch (err) {
      ec(err)
      var stateXML = null
    } finally {
      return new Promise(async function(resolve, reject) {
        parser.parseString(stateXML, async function(err, result) {
          if (err) reject(err)
          else {
            if (result) {
              await parseClientState(result.client_state).catch(ec)
              resolve(result.client_state)
            } else resolve(null)
          }
        })
      })
    }
}

var parseClientState = async (state) => {
  var wcgid = null
  try {
    var wcg = state.project.findIndex((project)=>{
      return project.project_name[0] == 'World Community Grid'
    })
    if(wcg > -1){
      needsProject = false
      wcgid = state.project[wcg].hostid[0]
    }
  } catch (error) {
    needsProject = true
    if (!attachingProject){
      attachingProject = true
      addUserProject()
    }
  }
  b.device = {
    wcgid,
    cpid: state.host_info[0].host_cpid[0],
    name: state.host_info[0].domain_name[0],
    os: {
      name: state.host_info[0].os_name[0]
      // version: state.host_info[0].os_version[0]
    },
    cpu: {
      threads: state.host_info[0].p_ncpus[0],
      model: state.host_info[0].p_model[0]
    }
  }
  events.emit('deviceReady', b.device)
}

var killExisting = async () => {
  try {
    if (b.boincD) boinc.cmd('quit')
    // else {
      if (thisPlatform === 'win32') await execP('Taskkill /IM boinc.exe /F')
      else await execP('pkill -9 boinc')
    // }
    console.log('removed existing')
  } catch (error) {
    console.log('No Existing processes')
  }
}

var b = {
  events,
  boincD: null,
  toggle:false,
  initializing: false,
  boincCMD: null,
  device: null,
  projects: null,
  shouldBeRunning: false,
  activeTasks: async () => {
    try {
      var state = await updateClientState()
      
      if (state.active_task_set[0]){
        b.events.emit('activeTasks', state.active_task_set[0].active_task)
        return state.active_task_set[0].active_task
      } 
      else return []
    } catch (err) {
      b.events.emit('activeTasks', [])
      return []
    }
  },
  dataDir() {
    if (thisPlatform != 'win32') return BOINCPATHRAW
    else return BOINCPATHRAW
  },
  globalPrefs(){return path.join(b.dataDir(), 'global_prefs_override.xml')},
  updateClientState,
  killExisting,
  delete: async () => {
    await fs.remove(BOINCPATH).catch(ec)
    console.log('DELETED BOINC DIR')
  },
  config:{
    init:async()=>{
      console.log('start config.init')
      var result = await fs.writeFile(b.globalPrefs(),builder.buildObject({global_preferences})).catch(ec)
      if (!result) return null
      b.config.get().catch(ec)
      console.log('CONFIG INIT:',result)
    },
    get:async(once)=>{
      // console.log('start config.get')
      // var configXML = await fs.readFile(path.join(b.dataDir(), 'cc_config.xml'))
      try {
        var prefsXml = await fs.readFile(b.globalPrefs()) 
      } catch (error) {
        // console.log('PREFSXML:',prefsXml)
        // console.log(error)
      }
      if(!prefsXml) return null
        configParser.parseString(prefsXml, async function(err, result) {
          if (err) return ec(err)
          else {
            if (result) {
              var preferences = result.global_preferences
              for (var key in preferences){
                if (preferences.hasOwnProperty(key)){
                  preferences[key] = parseFloat(preferences[key])
                }
              }
              // console.log('Parsed Prefs XML:',preferences)
              b.events.emit('config',preferences)
              return preferences
            } else return null
          }
        })
    },
    set: async(global_preferences)=>{
      console.log('got configData in BOINC!!!')
      var result = await fs.writeFile(b.globalPrefs(),builder.buildObject({global_preferences})).catch(ec)
      await b.cmd('read_global_prefs_override')
      b.config.get().catch(ec)
    }
  },
  unzip: async () => {
    var unzipper = new unzip(path.join(RESOURCEDIR, 'BOINC-Win32.zip'))
    return new Promise((resolve, reject) => {
      console.log('STARTING TO UNZIP')
      unzipper.on('error', function(err) {
        console.error('Caught an error', err)
        reject(err)
      })

      unzipper.on('extract', function(log) {
        // console.log('Finished extracting', log)
        resolve(log)
      })

      unzipper.on('progress', function(fileIndex, fileCount) {
        console.log('Extracted file ' + (fileIndex + 1) + ' of ' + fileCount)
      })

      unzipper.extract({
        path: BOINCPATHRAW,
        filter: function(file) {
          return file.type !== 'SymbolicLink'
        }
      })
    })
  },
  sandbox: async () => {
    if (thisPlatform === 'win32'){
      console.log('Starting Unzip from Sandbox')
      await b.unzip().catch(ec)
    } else
    return new Promise((resolve, reject) => {
      try{
        fs.ensureDirSync(BOINCPATH)
      }catch(err){
        ec(err)
        console.error(err)
      }
      var cmd1 = 'unzip -o ' + path.join(RESOURCEDIR, 'BOINC-Darwin.zip') + ' -d ' + BOINCPATH
      var cmd2 = 'sh ' + path.join(RESOURCEDIR, 'boidSandbox.sh') + ' ' + BOINCPATH
      var cmd = 'sh -c "'+ cmd1 + '; ' + cmd2 + '"'
      console.log(cmd)

      sudo.exec(cmd, spawnConfig, function(err, stdout, stderr) {
        if (err) reject(err)
        if (stdout) {
          console.log(stdout)
          if (stdout.indexOf('Changed directory') > -1) {
            console.log('SANDBOX FINISHED')
            b.intializing = false
            resolve(stdout)
          }
        }
        if (stderr) {
          // console.log(stderr)
          reject(stderr)
        }
      })
      b.events.emit('showWindow')
    })
  },
  install: async () => {
    try {
      await b.delete().catch(ec)
      console.log('BOINC INSTALL')
      // await b.unzip()
      console.log('FINISHED UNZIPING')
      await b.sandbox().catch(ec)
      console.log('FINISHED Sandbox')
      console.log(BOINCPATH)
    } catch (err) {
      ec(err)
    }
  },
  init: async (force) => {
    if (b.initializing) return console.log('already initializing...')
    console.log('Starting Init with override:',force)
    await killExisting()
    await clearLocks()
    await fs.outputFile(path.join(b.dataDir(), 'remote_hosts.cfg'), 'localhost').catch(ec)
    try {
      var exists = await fs.exists(path.join(BOINCPATHRAW, 'ca-bundle.crt'))
      console.log("EXISTS?",exists,!force)
      if (exists && !force) return console.log('BOINC is installed')
      else {
        if (b.initializing) return console.log('already initializing...')
        b.initializing = true
        await b.sandbox().catch(ec)
        await b.config.init().catch(ec)
        return console.log('finished with config init')
        await b.start().catch(ec)
        return new Promise((resolve, reject) => {
          console.log('boinc initialized')
          resolve()
        })
      }
    } catch (err) {
      ec(err)
    }
  },
  start: async () => {
    b.shouldBeRunning = true
    if (b.initializing) return console.log('boincD is already initializing')
   
    var result = await b.init(false).catch(ec)
    if (!result) console.error('Init broke')
    console.log('starting BOINC')
    if (b.boincD) return console.log('boincD is already running')
    var exe
    if (thisPlatform === 'win32') exe = 'boinc.exe'
    else exe = './boinc'
    try {
      b.boincD = spawn(exe, ['-dir', BOINCPATHRAW, '-allow_multiple_clients', '-no_gpus','-allow_remote_gui_rpc'], {
        silent: false,
        cwd: BOINCPATHRAW,
        shell: false,
        detached: false,
        env: null
      })
    } catch (error) {
      ec(error)
    }
    setupBoincDListeners()
    b.events.emit('toggle', true)
  },
  cmd: async (cmd) => {
    // console.log('GOT CMD:',cmd)
    // console.log('SHOULD BE RUNNING?',b.shouldBeRunning)
    if (!b.shouldBeRunning) return null
    var pass = await fs.readFile(path.join(b.dataDir(), 'gui_rpc_auth.cfg'), 'utf8').catch(ec)
    var exe = "dope"
    if (thisPlatform === "win32") exe = 'boinccmd'
    else exe = './boinccmd'
    if (cmd == 'quit') b.shouldBeRunning = false
    return new Promise(function(resolve, reject) {
      exec(exe + ` --host localhost --passwd ` + pass + ' --' + cmd, { cwd: b.dataDir() }, function(err, stdout, stderr) {
        if (err) console.error(err),resolve(err)
        if (stderr) console.error(stderr),resolve(stderr)
        if (stdout) console.log(stdout)
        resolve(stdout)
      })
    })
  },
  checkExisting: async function() {
    var result
    try {
      result = await execP('pgrep boinc')
    } catch (error) {
      // console.log(error)
      result = null
    }
    if (result) {
      console.log('Found Existing Boinc Process')
      if (!b.shouldBeRunning){
        killExisting()
      }else if(b.boincD){
        b.events.emit('toggle', true)
      }
    } else {
      console.log('There is no Boinc Process running')
      if (b.shouldBeRunning){
        b.start()
      }else{
        b.events.emit('toggle', false)
      }
    }
  }
}

process.on('unhandledException', () => {
  console.log('UNHANDLED EXEC')
  if (b.boincD) b.boincD.kill()
  killExisting()
})

process
  .on('SIGHUP', function() {
    log.message.info('[%s] Asterisk process hung up.', that.callerid)
    that.exitWhenReady(true)
  })
  .on('exit', function() {
    process.kill(process.pid, 'SIGTERM')
  })

process.on('exit', function() {
  console.log('Clean Exit')
  if (b.boincD) b.boincD.kill()
  killExisting()
})

module.exports = b
