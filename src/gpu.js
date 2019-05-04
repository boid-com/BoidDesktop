import { ipcMain, ipcRenderer } from 'electron'
const os = require('os')
const thisPlatform = os.platform()
var unzip = require('decompress-zip')
var fs = require('fs-extra')
const isDev = require('electron-is-dev')
var path = require('path')
require('fix-path')()


const { exec, spawn } = require('child-process-promise')
import { app } from 'electron'

function dir(dir) {
  return dir.replace(/(["\s'$`\\])/g, '\\ ')
}

if (isDev) var HOMEPATHRAW = path.join(app.getPath('home'), '.BoidDev')
else var HOMEPATHRAW = path.join(app.getPath('home'), '.Boid')
var GPUPATH = path.join(HOMEPATHRAW, 'GPU')
var RESOURCEDIR = path.join(__dirname, '../')
const TREXPATH = path.join(GPUPATH, 'TREX')


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

    ipcMain.on('gpu.startTrex', async (event, arg) => {
      gpu.window = event.sender
      event.sender.send('gpu.status', 'Checking Miner Install')
      const status = await gpu.startTrex()
    })
  },
  async getGPU() {
    console.log('getGPU', thisPlatform)
    if (thisPlatform === 'win32') {
      const gpu = (await exec('wmic path win32_VideoController get name')).stdout
      console.log(gpu)
      return gpu
    } else return 'test GPU'
  },
  async unzip(zipFile,desination){
    var unzipper = new unzip(zipFile)
    return new Promise((resolve, reject) => {
      console.log('STARTING TO UNZIP')
      unzipper.on('error', function(err) {
        console.error('Caught an error', err)
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
        path: desination,
        filter: function(file) {
          return file.type !== 'SymbolicLink'
        }
      })
    })
  },
  async installTRex() {
    gpu.emit('status', 'Installing Trex...')
    try {
      const result = await gpu.unzip(path.join(RESOURCEDIR,'trex.zip'),TREXPATH)
      console.log(result)
      gpu.emit('status',result)
      return true
    } catch (error) {
      gpu.emit('error',error)
      console.error(error)
      return false
    }


    return 'ok'
  },
  async startTrex() {
    const result = await fs.exists(path.join(TREXPATH, 't-rex.exe')).catch(console.log)
    if (!result) {
      gpu.emit('status', 'Trex not installed')
      const installed = await gpu.installTRex()
      if (installed) gpu.startTrex()
      else gpu.emit('message', 'Unable to start due to Install error')
    }else{
      console.log('ready to start trex')
      gpu.emit('status','starting...')
    }


  }
}

// gpu.getGPU()

module.exports = gpu
