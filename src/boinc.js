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

var HOMEPATH = dir(path.join(app.getPath('home'), '.Boid'))
var BOINCPATHRAW = path.join(HOMEPATH, 'BOINC')
var BOINCPATH = dir(BOINCPATHRAW)
var RESOURCEDIR = dir(path.join(__dirname, '../'))
var global_preferences = {run_if_user_active:'1',cpu_usage_limit:'80.0',max_ncpus_pct:'100',idle_time_to_run:'3.0',ram_max_used_busy_pct:'50.0',ram_max_used_idle_pct:'75.0'}
console.log('BOINCPATH:', BOINCPATH)

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
      boincDInitialized()
    } else if (data.indexOf('This computer is not attached to any projects') > -1) {
      needsProject = true
    } else if (data.indexOf('File ownership or permissions are set') > -1) {
      console.log('permissions are not set correctly')
      b.cmd('stop')
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
    console.log(`boincDErr: ${data}`)
  })

  b.boincD.on('close', (code) => {
    console.log(`boincD exited with code ${code}`)
    b.checkExisting()
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
    console.log('SLOTS ERR', err)
  }
}
var addUserProject = async () => {
  var userProjectURL = 'http://www.worldcommunitygrid.org/'
  var addProject = 'project_attach ' + userProjectURL + ' ' + weakKey
  await b.cmd(addProject).catch(console.log)
}

var boincDInitialized = async () => {
  if (needsProject) await addUserProject().catch(console.log)
  var clientState = await updateClientState().catch(console.log)
  console.log('cpid', b.device)
}

var updateClientState = async () => {
  var exists = await fs.exists(path.join(b.dataDir(), './client_state.xml')).catch(console.log)
  if (!exists) return null
  else
    try {
      var stateXML = await fs.readFile(path.join(b.dataDir(), 'client_state.xml'))
    } catch (err) {
      console.log(err)
      var stateXML = null
    } finally {
      return new Promise(async function(resolve, reject) {
        // console.log('we are here')
        parser.parseString(stateXML, async function(err, result) {
          if (err) reject(err)
          else {
            if (result) {
              // console.log(result.client_state)
              // console.log('why did it comes to this')
              await parseClientState(result.client_state)
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
      wcgid = state.project[wcg].hostid[0]
    }
  } catch (error) {
    console.log('lul')
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
    // if (b.boincD) boinc.cmd('quit')
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
  initializing: false,
  boincCMD: null,
  device: null,
  projects: null,
  shouldBeRunning: false,
  activeTasks: async () => {
    try {
      var state = await updateClientState()
      b.events.emit('activeTasks', state.active_task_set)
      if (state.active_task_set[0]) return state.active_task_set[0].active_task
      else return []
    } catch (err) {
      return []
    }
  },
  dataDir() {
    if (thisPlatform != 'win32') return BOINCPATHRAW
    else return 'C:/BOINC/'
  },
  globalPrefs(){return path.join(b.dataDir(), 'global_prefs_override.xml')},
  updateClientState,
  killExisting,
  delete: async () => {
    await fs.remove(BOINCPATH).catch(console.log)
    console.log('DELETED BOINC DIR')
  },
  config:{
    get:async()=>{
      // var configXML = await fs.readFile(path.join(b.dataDir(), 'cc_config.xml'))
      try {
        var prefsXml = await fs.readFile(b.globalPrefs()) 
      } catch (error) {
        console.log('PREFSXML:',prefsXml)
        // console.log(error)
      }
      if(!prefsXml){
        var result = await fs.writeFile(b.globalPrefs(),builder.buildObject({global_preferences})).catch(console.log)
        b.config.get()
      }
      else
        configParser.parseString(prefsXml, async function(err, result) {
          if (err) return console.log(err)
          else {
            if (result) {
              var preferences = result.global_preferences
              for (var key in preferences){
                if (preferences.hasOwnProperty(key)){
                  preferences[key] = parseFloat(preferences[key])
                }
              }
              console.log('Parsed Prefs XML:',preferences)
              b.events.emit('config',preferences)
              return preferences
            } else return null
          }
        })
    },
    set:async(global_preferences)=>{
      console.log('got configData in BOINC!!!')
      var result = await fs.writeFile(b.globalPrefs(),builder.buildObject({global_preferences})).catch(console.log)
      await b.cmd('read_global_prefs_override')
      b.config.get()
    }
  },
  unzip: async () => {
    var unzipper = new unzip(path.join(RESOURCEDIR, 'BOINC-Darwin.zip'))
    return new Promise((resolve, reject) => {
      unzipper.on('error', function(err) {
        console.log('Caught an error', err)
        reject(err)
      })

      unzipper.on('extract', function(log) {
        console.log('Finished extracting', log)
        resolve(log)
      })

      unzipper.on('progress', function(fileIndex, fileCount) {
        console.log('Extracted file ' + (fileIndex + 1) + ' of ' + fileCount)
      })

      unzipper.extract({
        path: BOINCPATH,
        filter: function(file) {
          return file.type !== 'SymbolicLink'
        }
      })
    })
  },
  sandbox: async () => {
    return new Promise((resolve, reject) => {
      var cmd = 'unzip -o ' + path.join(RESOURCEDIR, 'BOINC-Darwin.zip') + ' -d ' + BOINCPATH + ' && ' + 'sh ' + path.join(RESOURCEDIR, 'BoidSandbox.sh') + ' ' + BOINCPATH
      // cmd = cmd.replace(' ', '\\ ')
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
      await b.delete()
      console.log('BOINC INSTALL')
      // await b.unzip()
      console.log('FINISHED UNZIPING')
      await b.sandbox()
      console.log('FINISHED Sandbox')
      console.log(BOINCPATH)
    } catch (err) {
      console.log(err)
    }
  },
  init: async (force) => {
    await killExisting()
    await clearLocks()
    // await fs.outputFile(path.join(b.dataDir(), 'remote_hosts.cfg'), 'localhost').catch(console.log)
    try {
      var exists = await fs.exists(path.join(BOINCPATHRAW, 'client_state.xml'))
      if (exists && !force) return console.log('client_state exists')
      else {
        if (b.initializing) return console.log('already initializing...')
        b.initializing = true
        await b.sandbox()
        await b.start()
        return new Promise((resolve, reject) => {
          console.log('boinc initialized')
          resolve()
        })
      }
    } catch (err) {
      console.log('there was an error', err)
      b.events('error', err)
    }
  },
  start: async () => {
    b.shouldBeRunning = true
    await b.init()
    b.boincD = spawn('./boinc', {
      silent: false,
      cwd: b.dataDir(),
      shell: true,
      detached: false,
      env: null
    })
    setupBoincDListeners()
    b.events.emit('toggle', true)
  },
  cmd: async (cmd) => {
    if (cmd == 'quit') b.shouldBeRunning = false
    var cmd = new Promise(async function(resolve, reject) {
      exec('./boinccmd ' + ' --' + cmd, { cwd: b.dataDir() }, function(err, stdout, stderr) {
        cmd.then()
        if (err) resolve(err)
        if (stderr) resolve(stderr)
        // console.log(stdout)
        resolve(stdout)
      })
    })
    return cmd
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
