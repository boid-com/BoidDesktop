const spawn = require('child_process').spawn
const exec = require('child_process').exec
const execP = require('child-process-promise').exec
const fixPath = require('fix-path')
var weakKey = '1061556_a0c611b081f8692b7ef0c11d39e6105c'
var fs = require('fs-extra')
var xml2js = require('xml2js')
var parser = new xml2js.Parser()
var path = require('path')
var needsProject = false
fixPath()
var thisPlatform = process.platform
const EventEmitter = require('events')
var events = new EventEmitter()

var spawnConfig = {
  cwd: path.join(__dirname, 'BOINC')
}

function setupBoincDListeners() {
  if (!b.boincD) return
  b.boincD.stdout.on('data', (data) => {
    console.log(`boincD: ${data}`)
    if (data.indexOf('Initialization completed') > -1) {
      boincDInitialized()
    } else if (data.indexOf('This computer is not attached to any projects') > -1) {
      needsProject = true
    }
  })

  b.boincD.stderr.on('data', (data) => {
    console.log(`boincD: ${data}`)
  })

  b.boincD.on('close', (code) => {
    console.log(`boincD exited with code ${code}`)
  })
}

var addUserProject = async () => {
  var userProjectURL = 'http://www.worldcommunitygrid.org/'
  var addProject = 'project_attach ' + userProjectURL + ' ' + weakKey
  await b.cmd(addProject).catch(console.log)
}

var boincDInitialized = async () => {
  if (needsProject) await addUserProject().catch(console.log)
  var clientState = await updateClientState()
  console.log('cpid', b.device)
}

var updateClientState = async () => {
  var stateXML = await fs.readFile(b.dataDir + 'client_state.xml').catch(console.log)
  return new Promise(async function(resolve, reject) {
    parser.parseString(stateXML, async function(err, result) {
      if (err) reject(err)
      else {
        await parseClientState(result.client_state)
        resolve(result.client_state)
      }
    })
  })
}

var parseClientState = async (state) => {
  b.device = {
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
    else {
      if (thisPlatform === 'win32') await execP('Taskkill /IM boinc.exe /F')
      else await execP('pkill -9 boinc')
    }
    console.log('removed existing')
  } catch (error) {
    console.log('No Existing processes')
  }
}

var b = {
  events,
  boincD: null,
  boincCMD: null,
  device: null,
  projects: null,
  dataDir: 'C:/BOINC/',
  updateClientState,
  killExisting,
  init: async () => {
    console.log('BOINC INIT')
    console.log(spawnConfig.cwd)
    await killExisting()
    await fs.outputFile(path.join(b.dataDir, 'remote_hosts.cfg'), 'localhost').catch(console.log)

    b.boincD = spawn('boinc', ['-dir', b.dataDir, '-allow_multiple_clients', '-no_gpus'], {
      silent: false,
      cwd: path.join(__dirname, 'BOINC'),
      shell: true,
      detached: false,
      env: null
    })
    setupBoincDListeners()
  },
  cmd: async (cmd) => {
    var pass = await fs.readFile(path.join(b.dataDir, '/gui_rpc_auth.cfg'), 'utf8')
    var cmd = new Promise(async function(resolve, reject) {
      exec('boinccmd ' + `--host localhost --passwd ` + pass + ' --' + cmd, spawnConfig, function(err, stdout, stderr) {
        if (err) reject(err), console.log(err)
        if (stderr) resolve(stderr), console.log(stderr)
        console.log(stdout)
        resolve(stdout)
      })
    })
    return cmd
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
