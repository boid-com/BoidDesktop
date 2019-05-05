import { ipcMain, ipcRenderer } from 'electron'
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

function dir(dir) {
  return dir.replace(/(["\s'$`\\])/g, '\\ ')
}

if (isDev) var HOMEPATHRAW = path.join(app.getPath('home'), '.BoidDev')
else var HOMEPATHRAW = path.join(app.getPath('home'), '.Boid')
var GPUPATH = path.join(HOMEPATHRAW, 'GPU')
var RESOURCEDIR = path.join(__dirname, '../')
const TREXPATH = path.join(GPUPATH, 'trex')

function isFunction(value) {
  return typeof value === 'function';
}
function isObject(value) {
  return value && typeof value === 'object' && value.constructor === Object;
}

async function setupIPC(methods, prefix1, prefix2) {
  if (!prefix2) prefix2 = ''
  else prefix2 = prefix2 + '.'
  for (var methodName of Object.keys(methods)) {
    if (!isFunction(methods[methodName])) await setupIPC(methods[methodName], prefix1, methodName)
    if (isObject(methods[methodName])) continue
    console.log(methods[methodName])
    const channel = 'gpu.' + prefix1 + '.' + prefix2 + methodName
    console.log(channel)

    ipcMain.on(channel, async (event, arg) => {
      console.log(channel + '()')
      gpu.emit(channel, await eval(channel + '(' + arg + ')'))
    })
  }
}

var gpu = {
  window: null,
  emit(channel, data) {
    if (gpu.window) gpu.window.send('gpu.' + channel, data)
    console.log('gpuEmit:', channel, data)
  },
  async init(appWindow) {
    gpu.window = appWindow
    ipcMain.on('getGPU', gpu.getGPU)

    ipcMain.on('gpu.getGPU', async (event, arg) => {
      gpu.window = event.sender
      console.log(arg) // prints "ping"
      const result = await gpu.getGPU()
      event.sender.send('gpu.getGPU', result)
    })
    setupIPC(gpu.trex, 'trex')
    
  },
  async getGPU() {
    if (thisPlatform === 'win32') {
      await exec('dxdiag /x dxdiag.xml', { cwd: GPUPATH, timeout: 3 }).catch(() => { })
      const displayDevices = (await parseXML(path.join(GPUPATH, 'dxdiag.xml'))).DxDiag.DisplayDevices
      var gpus = []
      for (var device of displayDevices) {
        var thisDevice = {}
        thisDevice.id = device.DisplayDevice[0].DeviceID[0]
        thisDevice.name = device.DisplayDevice[0].ChipType[0]
        gpus.push(thisDevice)
      }
      // console.log('returning GPUs',gpus)
      return gpus
    } else return null
  },
  async unzip(zipFile, desination) {
    var unzipper = new unzip(zipFile)
    return new Promise((resolve, reject) => {
      console.log('STARTING TO UNZIP')
      unzipper.on('error', function (err) {
        console.error('Caught an error', err)
        reject(err)
      })

      unzipper.on('extract', function (log) {
        console.log('Finished extracting', log)
        resolve(log)
      })

      unzipper.on('progress', function (fileIndex, fileCount) {
        console.log('Extracted file ' + (fileIndex + 1) + ' of ' + fileCount)
      })

      unzipper.extract({
        path: desination,
        filter: function (file) {
          return file.type !== 'SymbolicLink'
        }
      })
    })
  },
  trex: {
    async install() {
      gpu.emit('status', 'Installing Trex...')
      try {
        const result = await gpu.unzip(path.join(RESOURCEDIR, 'trex.zip'), TREXPATH)
        console.log(result)
        gpu.emit('status', result)
        await gpu.trex.config.init()
        return true
      } catch (error) {
        gpu.emit('error', error)
        console.error(error)
        return false
      }

    },
    async checkInstalled(){
      const result = await fs.exists(path.join(TREXPATH, 't-rex.exe')).catch(console.log)
      if (!result) gpu.emit('status', 'Trex not installed')
      return result
    },
    async start() {
      const result = await gpu.trex.checkInstalled()
      if (!result) {
        const installed = await gpu.trex.install()
        if (installed) gpu.trex.start()
        else gpu.emit('message', 'Unable to start due to install error.')
      } else {
        console.log('ready to start trex')
        gpu.emit('status', 'starting...')
        try {
          gpu.shouldBeRunning = true
          if (gpu.trex.miner && gpu.trex.miner.killed === false) return gpu.trex.miner.kill()
          gpu.trex.miner = spawn('./t-rex.exe',
            ['-a', 'x16r', '-o', 'stratum+tcp://rvn.boid.com:3636', '-u', 'RHoQhptpZRHdL2he2FEEXwW1wrxmYJsYsC.cjv74fygjupf109942wo0j9qf', '-i', '20'], {
              silent: false,
              cwd: TREXPATH,
              shell: false,
              detached: false,
              env: null
            })
          gpu.trex.miner.stdout.on('data', data => gpu.emit('status', data.toString()))
          gpu.trex.miner.stderr.on('data', data => gpu.emit('error', data.toString()))
          gpu.trex.miner.on('exit', (code, signal) => {
            console.log('detected close code:', code, signal)
            console.log('should be running', gpu.shouldBeRunning)
            gpu.trex.miner.removeAllListeners()
            gpu.trex.miner = null
            if (gpu.shouldBeRunning) {
              gpu.emit('message', 'The Miner stopped and Boid is restarting it')
              gpu.trex.start()
            } else {
              gpu.emit('message', 'The Miner was stopped')
              gpu.emit('status', 'Stopped')
              gpu.emit('toggle', false)
            }
          })
        } catch (error) {
          console.error(error)
          gpu.emit('error', error)
          return
        }
      }
    },
    async stop() {
      gpu.shouldBeRunning = false
      if (!gpu.trex.miner) return gpu.emit('toggle', false)
      gpu.trex.miner.kill()
      return 'finished stopping'
    },
    async getStats() {
      try {
        console.log('get stats')
        const stats = (await ax.get('http://127.0.0.1:4067/summary')).data
        if (stats) { gpu.emit('trex.getStats', stats) }
        else gpu.emit('error', 'Error getting t-rex miner stats')
      } catch (error) {
        gpu.emit('error', error)
      }
    },
    config: {
      async init() { return 'hello from config init' },
      async set() { },
      async get() { }
    }
  }

}

// gpu.getGPU()

module.exports = gpu
