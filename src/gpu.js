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
import { app } from 'electron'

function dir(dir) {
  return dir.replace(/(["\s'$`\\])/g, '\\ ')
}

if (isDev) var HOMEPATHRAW = path.join(app.getPath('home'), '.BoidDev')
else var HOMEPATHRAW = path.join(app.getPath('home'), '.Boid')
var GPUPATH = path.join(HOMEPATHRAW, 'GPU')
var RESOURCEDIR = path.join(__dirname, '../')
const TREXPATH = path.join(GPUPATH, 'trex')


var gpu = {
  window: null,
  emit(channel, data) {
    if (gpu.window) gpu.window.send('gpu.' + channel, data)
    console.log('gpuEmit:', channel, data)
  },
  async init(appWindow) {
    gpu.window = appWindow
    ipcMain.on('gpu', (el, msg) => console.log(msg))
    ipcMain.on('getGPU', gpu.getGPU)

    ipcMain.on('gpu.getGPU', async (event, arg) => {
      gpu.window = event.sender
      console.log(arg) // prints "ping"
      const result = await gpu.getGPU()
      event.sender.send('gpu.getGPU', result)
    })

    ipcMain.on('gpu.trex.start', async (event, arg) => {
      gpu.window = event.sender
      event.sender.send('gpu.status', 'Checking Miner Install')
      const status = await gpu.trex.start()
    })
    ipcMain.on('gpu.trex.stop', async (event, arg) => gpu.trex.stop())
    ipcMain.on('gpu.trex.getStats',async (event,arg)=> gpu.trex.getStats())
  },
  async getGPU() {
    console.log('getGPU', thisPlatform)
    if (thisPlatform === 'win32') {
      await exec('dxdiag /x dxdiag.xml',{ cwd: GPUPATH, timeout:3}).catch(()=>{})
      const displayDevices = (await parseXML(path.join(GPUPATH,'dxdiag.xml'))).DxDiag.DisplayDevices
      console.log(displayDevices)
      return displayDevices
    } else return 'test GPU'
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
        return true
      } catch (error) {
        gpu.emit('error', error)
        console.error(error)
        return false
      }

    },
    async start() {
      const result = await fs.exists(path.join(TREXPATH, 't-rex.exe')).catch(console.log)
      if (!result) {
        gpu.emit('status', 'Trex not installed')
        const installed = await gpu.trex.install()
        if (installed) gpu.trex.start()
        else gpu.emit('message', 'Unable to start due to Install error')
      } else {
        console.log('ready to start trex')
        gpu.emit('status', 'starting...')
        try {
          gpu.shouldBeRunning = true
          if (gpu.trex.miner && gpu.trex.miner.killed === false ) return gpu.trex.miner.kill()
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
              gpu.emit('message','The Miner stopped and Boid is restarting it')
              gpu.trex.start()
            } else{
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
    async stop(){
      gpu.shouldBeRunning = false
      if (!gpu.trex.miner) return gpu.emit('toggle', false)
      gpu.trex.miner.kill()
    },
    async getStats(){
      try {
        console.log('get stats')
        const stats = (await ax.get('http://127.0.0.1:4067/summary')).data
        if (stats) { gpu.emit('trex.getStats',stats) }
        else gpu.emit('error', 'Error getting t-rex miner stats')
      } catch (error) {
        gpu.emit('error',error)
      }
    }
  }

}

// gpu.getGPU()

module.exports = gpu
