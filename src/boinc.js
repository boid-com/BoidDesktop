const spawn = require('child_process').spawn
const exec = require('child-process-promise').exec
const fixPath = require('fix-path')
var weakKey = '1061556_a0c611b081f8692b7ef0c11d39e6105c'
var fs = require('fs-extra')
var xml2js = require('xml2js')
var parser = new xml2js.Parser()
import path from 'path'
var needsProject = false
fixPath()

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
  var addProject = '--project_attach ' + userProjectURL + ' ' + weakKey

  await b.cmd(addProject).catch(console.log)
}

var boincDInitialized = async () => {
  if (needsProject) await addUserProject().catch(console.log)
  var clientState = await updateClientState()
  console.log('cpid', b.device)
}

var updateClientState = async () => {
  var stateXML = await fs.readFile(__dirname + '/BOINC/client_state.xml').catch(console.log)
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
      name: state.host_info[0].os_name[0],
      version: state.host_info[0].os_version[0]
    },
    cpu: {
      threads: state.host_info[0].p_ncpus[0],
      model: state.host_info[0].p_model[0]
    }
  }
}

var b = {
  boincD: null,
  boincCMD: null,
  device: null,
  projects: null,
  updateClientState,
  init: async () => {
    console.log('BOINC INIT')
    console.log(spawnConfig.cwd)
    await exec('pkill -9 boinc').catch(() => {})
    try {
      b.boincD = spawn('./boinc', [], spawnConfig)
      // boincDInitialized()
      // b.cmd('--get_host_info')
      setupBoincDListeners()
    } catch (error) {
      throw error
    }
  },
  cmd: async (cmd) => {
    var result = await exec('./boinccmd ' + cmd, spawnConfig).catch(console.log)
    console.log(result.stdout)
    console.log(result.stderr)
  }
}

process.on('unhandledException', () => {
  console.log('UNHANDLED EXEC')
  if (b.boincD) b.boincD.kill()
  exec('pkill -9 boinc')
})
module.exports = b
