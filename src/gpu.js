const { ipcMain, app} = require('electron')
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
const cfg = require('electron-settings')
const log = require('electron-log')
const boidAppEvents = require('./boidAppEvents')  //<--- Our In-House nodeJS module for events sub/sink.

function ec(error){
  log.error(error)
  if (gpu.window) gpu.emit('error',{date:Date.now(),error})
  else ipcMain.emit('error',{date:Date.now(),error})
}
async function sleep(){return new Promise(resolve => setTimeout(resolve,3000))}

async function download(url, dest) {
  var file = fs.createWriteStream(dest)
  const response = await ax({
    url,
    method: 'GET',
    responseType: 'stream'
  })
  response.data.pipe(file)
  return new Promise((res, rej) => {
    file.on('finish', res)
    file.on('error', rej)
  })
 
}

function dir (dir) { return dir.replace(/(["\s'$`\\])/g, '\\ ') }

var HOMEPATHRAW = path.join(app.getPath('home'), '.Boid')
// if(isDev) var HOMEPATHRAW = path.join(app.getPath('home'), '.BoidDev')
// else var HOMEPATHRAW = path.join(app.getPath('home'), '.Boid')
var GPUPATH = path.join(HOMEPATHRAW, 'GPU')
if (isDev) var RESOURCEDIR = path.join(__dirname, '../')
else var RESOURCEDIR = path.join(__dirname, '../../')
const TREXPATH = path.join(GPUPATH, 'trex')
const WILDRIGPATH = path.join(GPUPATH, 'wildrig')


function isFunction (value) {
  return typeof value === 'function';
}

function isObject (value) {
  return value && typeof value === 'object' && value.constructor === Object;
}

async function setupIPC (methods, prefix1, prefix2) {
  try {
    if(!methods) return
    if(!prefix2) prefix2 = ''
    else prefix2 = prefix2 + '.'
    for(var methodName of Object.keys(methods)) {
      if(!isFunction(methods[methodName])) await setupIPC(methods[methodName], prefix1, methodName)
      if(isObject(methods[methodName])) continue
      const channel = 'gpu.' + prefix1 + '.' + prefix2 + methodName  
      ipcMain.on(channel, async (event, arg) => {
        gpu.window = event.sender
        log.info('IPC Event Received:', channel + '()')
        const emitChannel = channel.split('gpu.')[1]
        gpu.emit(emitChannel, await (eval(channel)(arg)))
      })
    }
  } catch (error) {
    log.error(error)
  }
}

var gpu = {
  eventsRegistered: false,
  deviceID: null,
  window: null,
  async reset () {
    //Minor optimization...
    if(gpu.wildrig.miner){
      await gpu.wildrig.stop()
    }
    //Minor optimization...
    if(gpu.trex.miner){
      await gpu.trex.stop()
    }
    try {
      await fs.remove(GPUPATH), gpu.emit('Message', "GPU Directory removed", GPUPATH)
      app.relaunch()
      app.exit()
    } catch (error) {
      log.error(error)
      gpu.emit("error", error)
    }

  },
  emit (channel, data, event) {
    try {
      if(gpu.window) gpu.window.send('gpu.' + channel, data)
      else log.info('window not set!')
    } catch (error) {
      log.error(error)
    }
    log.info('gpuEmit:', channel, data)
  },
  async on (channel, func) {
    channel = 'gpu.' + channel
    // log.info('ipcOn:', channel, func)
    return await ipcMain.on(channel, async (event, data) => {
      return await func(data)
    })
  },
  config: {
    async verify () {
      await fs.ensureDir(GPUPATH)
      const result = await fs.exists(path.join(GPUPATH, 'boid-gpu-config.json')).catch(log.info)
      if(!result) gpu.emit('status', 'gpu config missing')
      return result
    },
    async init (config) {
      try {
        if(!config) throw ('config missing')
        const exists = await gpu.config.verify()
        if(exists) {
          gpu.emit('config.read', await gpu.config.read())
        } else {
          gpu.emit('status', 'initializing')
          await jsonfile.writeFile(path.join(GPUPATH, 'boid-gpu-config.json'), config)
        }
        gpu.emit('config.read', await gpu.config.read())

        return gpu.config.read()
      } catch (error) {
        log.error(error)
        gpu.emit('error', error)
        return error
      }
    },
    async read () {
      try {
        var config = await jsonfile.readFile(path.join(path.join(GPUPATH, 'boid-gpu-config.json')))
        /*
         * In case of missing the new form of BOID parameters we must write them with an arbitrary value...
        */
        if(config.idleTimeToRun===undefined){
          config.idleTimeToRun=3
          config.runIfUserActive=true
          config.runOnBatteries=true
        }
        return config
      } catch (error) {
        await fs.remove(path.join(GPUPATH, 'boid-gpu-config.json'))
        log.info(error)
        gpu.emit('error', error)
        return null
      }
    },
    async write (config) {
      try {
        await jsonfile.writeFile(path.join(path.join(GPUPATH, 'boid-gpu-config.json')), config)
        gpu.emit('config.read', await gpu.config.read())
      } catch (error) {
        log.error('config write error')
      }
    }
  },
  async init (event, data) {
    gpu.window = event.sender
    gpu.deviceID = data
    gpu.emit('init', { HOMEPATHRAW, GPUPATH, TREXPATH, WILDRIGPATH })
    if(gpu.eventsRegistered) return
    ipcMain.on('gpu.getGPU', async () => gpu.emit('getGPU', await gpu.getGPU()))
    ipcMain.on('gpu.reset', (data) => gpu.reset())
    // ipcMain.on( 'gpu.config.init', async(event,data) => gpu.emit( 'config.init', await gpu.config.init(data) ) )
    // gpu.on('config.init',data => gpu.config.init(data))
    setupIPC(gpu.trex, 'trex')
    setupIPC(gpu.wildrig, 'wildrig')
    setupIPC(gpu.config, 'config')

    boidAppEvents.registerEvent('gpu.suspend', gpu.suspend) //<--- Register the suspend event...
    boidAppEvents.registerEvent('gpu.resume', gpu.resume)   //<--- Register the resume event...

    gpu.eventsRegistered = true
  },
  async getGPU () {
    try {
      if(thisPlatform === 'win32') {
        await fs.ensureDir(GPUPATH)
        const getName = (await exec('wmic path win32_VideoController get name')).stdout
        if(await fs.exists(path.join(GPUPATH, 'gpuName.txt'))) {
          var gpuName = await fs.readFile(path.join(GPUPATH, 'gpuName.txt')).catch(() => {})
          if(gpuName) gpuName = gpuName.toString()
        } else var gpuName = ""

        if(getName === gpuName) {
          const exists = await fs.exists(path.join(GPUPATH, 'dxdiag.xml'))
          if(!exists) await exec(`dxdiag /whql:off /x ${path.join(GPUPATH,'dxdiag.xml')}`, {
            cwd: GPUPATH
          })
        } else {
          log.info('GPU has changed or has not been initialized')
          gpu.emit('status', 'detecting hardware')
          await fs.writeFile(path.join(GPUPATH, 'gpuName.txt'), getName)
          await exec(`dxdiag /whql:off /x ${path.join(GPUPATH,'dxdiag.xml')}`, {
            cwd: GPUPATH
          })
        }
        try {
          await fs.ensureFile(path.join(GPUPATH, 'dxdiag.xml'))
          const displayDevices = (await parseXML(path.join(GPUPATH, 'dxdiag.xml'))).DxDiag.DisplayDevices
          var gpus = []
          for(var device of displayDevices) {
            var thisDevice = {}
            thisDevice.id = device.DisplayDevice[0].DeviceID[0]
            thisDevice.name = device.DisplayDevice[0].ChipType[0]
            gpus.push(thisDevice)
          }
          // log.info('returning GPUs',gpus)
          return gpus
        } catch (error) {
          log.error(error)
          gpu.emit('error', 'Problem reading GPU Devices, trying again.')
          await fs.remove(path.join(GPUPATH, 'dxdiag.xml'))
          await fs.remove(path.join(GPUPATH, 'gpuName.txt'))
          gpu.emit('getGPU', await gpu.getGPU())
        }

      } else {
        gpu.emit('status', 'this OS not supported')
        return null
      }
    } catch (error) {
      gpu.emit('error', error)
      gpu.emit('error', 'Problem reading GPU Devices, trying again.')
      await fs.remove(path.join(GPUPATH, 'dxdiag.xml'))
      await fs.remove(path.join(GPUPATH, 'gpuName.txt'))
      return gpu.emit('getGPU', await gpu.getGPU())
    }

  },
  async unzip (zipFile, desination) {
    var unzipper = new unzip(zipFile)
    return new Promise((resolve, reject) => {
      log.info('STARTING TO UNZIP')
      unzipper.on('error', function (err) {
        log.error('Caught an error', err)
        reject(err)
      })

      unzipper.on('extract', function (data) {
        log.info('Finished extracting', data)
        resolve(data)
      })

      unzipper.on('progress', function (fileIndex, fileCount) {
        log.info('Extracted file ' + (fileIndex + 1) + ' of ' + fileCount)
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
    async install () {
      gpu.emit('status', 'Installing Trex...')
      try {
        await fs.ensureDir(RESOURCEDIR)
        await fs.remove(path.join(HOMEPATHRAW, 'trex.zip'))
        await download("https://raw.githubusercontent.com/Boid-John/BoidDesktop/master/trex.zip",path.join(HOMEPATHRAW, 'trex.zip'))
        const result = await gpu.unzip(path.join(HOMEPATHRAW, 'trex.zip'), TREXPATH)
        await fs.remove(path.join(HOMEPATHRAW, 'trex.zip'))
        log.info(result)
        // gpu.emit( 'status', result )
        return true
      } catch (error) {
        gpu.emit('error', error)
        log.error(error)
        return false
      }
    },
    async checkInstalled () {
      const result = await fs.exists(path.join(TREXPATH, 't-rex.exe')).catch(log.error)
      if(!result) gpu.emit('status', 'Trex not installed')
      return result
    },
    async start () {
      const checkInstall = await gpu.trex.checkInstalled()
      if(!checkInstall) {
        const installed = await gpu.trex.install()
        if(installed) return gpu.trex.start()
        else return gpu.emit('message', 'Unable to start due to install error.')
      }
      log.info('ready to start trex')
      gpu.emit('status', 'Starting...')
      try {
        gpu.shouldBeRunning = true
        cfg.set('state.gpu.toggle', true)
        if(gpu.trex.miner && gpu.trex.miner.killed === false) return gpu.trex.miner.kill()
        gpu.trex.miner = spawn('t-rex.exe', ['-c', path.join(TREXPATH, 'boid-trex-config.json')], {
          silent: false,
          cwd: TREXPATH,
          shell: false,
          detached: false,
          env: null
        })
        gpu.trex.miner.stdout.on('data', data => gpu.emit('log', data.toString()))
        gpu.trex.miner.stderr.on('data', data => ec(data.toString()))
        gpu.trex.miner.on('exit', async (code, signal) => {
          log.info('detected close code:', code, signal)
          log.info('should be running', gpu.shouldBeRunning)
          gpu.trex.miner.removeAllListeners()
          gpu.trex.miner = null
          if(gpu.shouldBeRunning) {
            gpu.emit('message', 'The Miner stopped and Boid is restarting it')
            await sleep(10000)
            gpu.trex.start()
          } else {
            gpu.emit('message', 'The Miner was stopped')
            gpu.emit('status', 'Stopped')
            gpu.emit('toggle', false)
            cfg.set('state.gpu.toggle', false)
          }
        })
      } catch (error) {
        log.error(error)
        gpu.emit('error', error)
        return
      }
    },
    async stop () {
      gpu.shouldBeRunning = false
      cfg.set('state.gpu.toggle', false)
      if(!gpu.trex.miner) return gpu.emit('toggle', false)
      gpu.trex.miner.kill()
      return 'finished stopping'
    },
    async getStats () {
      try {
        log.info('get stats')
        const stats = (await ax.get('http://127.0.0.1:4067/summary')).data
        if(stats) return stats
        else gpu.emit('error', 'Error getting t-rex miner stats')
      } catch (error) {
        log.error('problem getting trex stats')
        gpu.emit('error', 'problem getting trex stats')
      }
    },
    config: {
      async verify () {
        await fs.ensureDir(TREXPATH)
        const result = await fs.exists(path.join(TREXPATH, 'boid-trex-config.json')).catch(log.info)
        if(!result) gpu.emit('status', 'trex config missing')
        return result
      },

      async init (config) {
        try {
          const exists = await gpu.trex.config.verify()
          if(exists) {
            const currentConfig = await jsonfile.readFile(path.join(TREXPATH, 'boid-trex-config.json'))
            if(currentConfig.pools[0].user != config.pools[0].user) {
              await jsonfile.writeFile(path.join(TREXPATH, 'boid-trex-config.json'), config)
            }
            gpu.emit('trex.config.read', await gpu.trex.config.read())
            return gpu.emit('status', 'trex config exists')
          } else {
            gpu.emit('status', 'initializing trex config...')
            await jsonfile.writeFile(path.join(TREXPATH, 'boid-trex-config.json'), config)
            gpu.emit('trex.config.read', await gpu.trex.config.read())
          }
          // gpu.emit('status', 'trex config initialized')
          return 'trex config initialized'
        } catch (error) {
          log.error(error)
          gpu.emit('error', error)
          return error
        }
      },
      async setIntensity (intensity) {
        try {
          if(intensity > 25 || intensity < 8) return u.emit('error', 'invalid intensity setting')
          var config = await jsonfile.readFile(path.join(TREXPATH, 'boid-trex-config.json'))
          config.intensity = intensity.toFixed(2)
          await jsonfile.writeFile(path.join(TREXPATH, 'boid-trex-config.json'), config)
          gpu.emit('trex.config.read', await gpu.trex.config.read())
        } catch (error) {
          log.error('setIntensity Error')
        }

      },
      async write () {

      },
      async read () {
        try {
          var config = await jsonfile.readFile(path.join(TREXPATH, 'boid-trex-config.json'))
          log.info('Read trex config')
          return config
        } catch (error) {
          log.info(error)
          gpu.emit('error', error)
        }
      }
    }
  },
  wildrig: {
    async install () {
      gpu.emit('status','Downloading Wildrig...')

      try {
        await fs.ensureDir(WILDRIGPATH)
        await fs.remove(path.join(HOMEPATHRAW, 'wildrig.zip'))
        await download("https://raw.githubusercontent.com/Boid-John/BoidDesktop/master/wildrig.zip",path.join(HOMEPATHRAW, 'wildrig.zip'))
        gpu.emit('status', 'Installing Wildrig...')
        const result = await gpu.unzip(path.join(HOMEPATHRAW, 'wildrig.zip'), WILDRIGPATH)
        await fs.remove(path.join(HOMEPATHRAW, 'wildrig.zip'))
        log.info(result)
        return true
      } catch (error) {
        gpu.emit('error', 'Error installing wildrig miner!')
        log.error(error)
        return false
      }
    },
    async checkInstalled () {
      const result = await fs.exists(path.join(WILDRIGPATH, 'wildrig.exe')).catch(log.info)
      if(!result) gpu.emit('status', 'wildrig not installed')
      return result
    },
    async start () {
      const checkInstall = await gpu.wildrig.checkInstalled()
      if(!checkInstall) {
        const installed = await gpu.wildrig.install()
        if(installed) return gpu.wildrig.start()
        else return gpu.emit('message', 'Unable to start due to install error.')
      }
      log.info('ready to start wildrig')
      gpu.emit('status', 'Starting...')
      try {
        gpu.shouldBeRunning = true
        cfg.set('state.gpu.toggle', true)
        if(gpu.wildrig.miner && gpu.wildrig.miner.killed === false) return gpu.wildrig.miner.kill()
        gpu.wildrig.miner = spawn('wildrig.exe', await gpu.wildrig.config.read(), {
          silent: false,
          cwd: WILDRIGPATH,
        })
        gpu.wildrig.miner.stdout.on('data', data => gpu.emit('log', data.toString()))
        gpu.wildrig.miner.stderr.on('data', data => ec(data.toString()))
        gpu.wildrig.miner.on('exit', async (code, signal) => {
          log.info('detected close code:', code, signal)
          log.info('should be running', gpu.shouldBeRunning)
          gpu.wildrig.miner.removeAllListeners()
          gpu.wildrig.miner = null
          if(gpu.shouldBeRunning) {
            gpu.emit('message', 'The Miner stopped and Boid is restarting it')
            await sleep(10000)
            gpu.wildrig.start()
          } else {
            gpu.emit('message', 'The Miner was stopped')
            gpu.emit('status', 'Stopped')
            gpu.emit('toggle', false)
            cfg.set('state.gpu.toggle', false)
          }
        })
      } catch (error) {
        log.error(error)
        gpu.emit('error', error)
        return
      }
    },
    async stop () {
      gpu.shouldBeRunning = false
      cfg.set('state.gpu.toggle', false)
      if(!gpu.wildrig.miner) return gpu.emit('toggle', false)
      gpu.wildrig.miner.kill()
      return 'finished stopping'
    },
    async getStats () {
      try {
        log.info('get stats')
        const stats = (await ax.get('http://127.0.0.1:4068')).data
        if(stats) return stats
        else gpu.emit('error', 'Error getting wildrig miner stats')
      } catch (error) {
        log.error('problem getting wildrig stats')
        gpu.emit('error', 'problem getting wildrig stats')
      }
    },
    config: {
      async verify () {
        await fs.ensureDir(WILDRIGPATH)
        const result = await fs.exists(path.join(WILDRIGPATH, 'boid-wildrig-config.json')).catch(log.info)
        if(!result) gpu.emit('status', 'wildrig config missing')
        return result
      },
      async init (config) {
        try {
          const exists = await gpu.wildrig.config.verify()
          if(exists) {
            const currentConfig = await gpu.wildrig.config.read()
            if(currentConfig[0] != config[0]) {
              await jsonfile.writeFile(path.join(WILDRIGPATH, 'boid-wildrig-config.json'), config)
            }
            gpu.emit('wildrig.config.read', await gpu.wildrig.config.read())
            return gpu.emit('status', 'wildrig config exists')
          } else {
            gpu.emit('status', 'initializing wildrig config...')
            await jsonfile.writeFile(path.join(WILDRIGPATH, 'boid-wildrig-config.json'), config)
            gpu.emit('wildrig.config.read', await gpu.wildrig.config.read())
          }
          return 'wildrig config initialized'
        } catch (error) {
          log.error(error)
          gpu.emit('error', error)
          return error
        }
      },
      async setIntensity (intensity) {
        try {
          if(intensity > 20 || intensity < 10) return gpu.emit('error', 'invalid intensity setting')
          var configArray = await jsonfile.readFile(path.join(WILDRIGPATH, 'boid-wildrig-config.json'))
          const index = configArray.findIndex(el => {
            el = el.split('=')
            el[0] = el[0].replace('--', '')
            return el[0] === 'opencl-launch'
          })
          configArray[index] = '--opencl-launch=' + intensity.toFixed(2) + 'x0'
          await jsonfile.writeFile(path.join(WILDRIGPATH, 'boid-wildrig-config.json'), configArray)
          gpu.emit('wildrig.config.read', await gpu.wildrig.config.read())
        } catch (error) {
          log.error('setIntensity Error')
        }

      },

      async read () {
        try {
          var config = await jsonfile.readFile(path.join(WILDRIGPATH, 'boid-wildrig-config.json'))
          log.info('Read wildrig config')
          return config
        } catch (error) {
          await fs.remove(path.join(WILDRIGPATH, 'boid-wildrig-config.json'))
          log.info(error)
          gpu.emit('error', error)
          return null
        }
      }
    }
  }
}

// ipcMain.on( 'gpu.init', gpu.init )

/* START OF EVENTS AREA */
gpu.suspend = async () => {
  if(gpu.shouldBeRunning){
    if(gpu.wildrig.miner){
      gpu.wildrig.stop()
    }
    if(gpu.trex.miner){
      gpu.trex.stop()
    }
    sleep(5000)
    gpu.shouldBeRunning = false
  }
}

gpu.resume = async () => {
  if(!gpu.shouldBeRunning){
    gpu.shouldBeRunning = true
    if(gpu.wildrig.miner){
      gpu.wildrig.start()
    }
    if(gpu.trex.miner){
      gpu.trex.start()
    }
  }
}
/* END OF EVENTS AREA */

module.exports = gpu