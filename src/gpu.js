import {
  ipcMain,
  ipcRenderer
} from 'electron'
const os = require( 'os' )
const thisPlatform = os.platform()
var unzip = require( 'decompress-zip' )
var fs = require( 'fs-extra' )
const isDev = require( 'electron-is-dev' )
var path = require( 'path' )
require( 'fix-path' )()
const spawn = require( 'child_process' ).spawn
const ax = require( 'axios' )
const parseXML = require( 'xml-to-json-promise' ).xmlFileToJSON
const {
  exec
} = require( 'child-process-promise' )
const jsonfile = require( 'jsonfile' )
import {
  app
} from 'electron'

function dir( dir ) {
  return dir.replace( /(["\s'$`\\])/g, '\\ ' )
}

if ( isDev ) var HOMEPATHRAW = path.join( app.getPath( 'home' ), '.BoidDev' )
else var HOMEPATHRAW = path.join( app.getPath( 'home' ), '.Boid' )
var GPUPATH = path.join( HOMEPATHRAW, 'GPU' )
var RESOURCEDIR = path.join( __dirname, '../' )
const TREXPATH = path.join( GPUPATH, 'trex' )
const WILDRIGPATH = path.join( GPUPATH, 'wildrig' )


function isFunction( value ) {
  return typeof value === 'function';
}

function isObject( value ) {
  return value && typeof value === 'object' && value.constructor === Object;
}

async function setupIPC( methods, prefix1, prefix2 ) {
  if ( !methods ) return
  if ( !prefix2 ) prefix2 = ''
  else prefix2 = prefix2 + '.'
  for ( var methodName of Object.keys( methods ) ) {
    if ( !isFunction( methods[ methodName ] ) ) await setupIPC( methods[ methodName ], prefix1, methodName )
    if ( isObject( methods[ methodName ] ) ) continue
    console.log( methods[ methodName ] )
    const channel = 'gpu.' + prefix1 + '.' + prefix2 + methodName
    console.log( channel )

    ipcMain.on( channel, async( event, arg ) => {
      gpu.window = event.sender
      console.log( 'IPC Event Received:', channel + '()' )
      const emitChannel = channel.split( 'gpu.' )[ 1 ]
      gpu.emit( emitChannel, await ( eval( channel )( arg ) ) )
    } )
  }
}

const ipc = {
  async on(channel, func) {
    channel = 'gpu.' + channel
    console.log('ipcOn:', channel, func)
    return await ipcMain.on(channel, async (event, data) => {
      return await func(data)
    })
  }
}

var gpu = {
  eventsRegistered: false,
  deviceID: null,
  window: null,
  async reset(){
    await gpu.wildrig.stop()
    await gpu.trex.stop()
    try {
      await fs.remove(GPUPATH), gpu.emit('Message',"GPU Directory removed",GPUPATH)
      app.relaunch()
      app.exit()
    } catch (error) {
      console.error(error)
      gpu.emit("error",error)
    }

  },
  emit( channel, data, event ) {
    if ( gpu.window ) gpu.window.send( 'gpu.' + channel, data )
    else console.log( 'window now set!' )

    console.log( 'gpuEmit:', channel, data )
  },
  async on(channel, func) {
    channel = 'gpu.' + channel
    console.log('ipcOn:', channel, func)
    return await ipcMain.on(channel, async (event, data) => {
      return await func(data)
    })
  },
  config:{
    async verify() {
      await fs.ensureDir( GPUPATH )
      const result = await fs.exists( path.join( GPUPATH, 'boid-gpu-config.json' ) ).catch( console.log )
      if ( !result ) gpu.emit( 'status', 'gpu config missing' )
      return result
    },
    async init( config ) {
      try {
        if (!config) throw('config missing')
        const exists = await gpu.config.verify()
        if ( exists ) {
          gpu.emit( 'config.read', await gpu.config.read() )
        } else {
          gpu.emit( 'status', 'initializing global gpu config...' )
          await jsonfile.writeFile( path.join( GPUPATH, 'boid-gpu-config.json' ), config )
        }
        gpu.emit( 'config.read', await gpu.config.read() )
        
        return gpu.config.read()
      } catch ( error ) {
        console.error( error )
        gpu.emit( 'error', error )
        return error
      }
    },
    async read() {
      try {
        var config = await jsonfile.readFile( path.join( path.join( GPUPATH, 'boid-gpu-config.json' )) )
        return config
      } catch ( error ) {
        await fs.remove(path.join( GPUPATH, 'boid-gpu-config.json' ))
        console.log( error )
        gpu.emit( 'error', error )
        return null
      }
    },
    async write(config) {
      try {
        await jsonfile.writeFile( path.join( path.join( GPUPATH, 'boid-gpu-config.json' )), config )
        gpu.emit( 'config.read', await gpu.config.read() )
      } catch ( error ) {
        console.error( 'config write error' )
      }
    }
  },
  async init( event, data ) {
    gpu.window = event.sender
    gpu.deviceID = data
    gpu.emit('init',{HOMEPATHRAW,GPUPATH,TREXPATH,WILDRIGPATH})
    if ( gpu.eventsRegistered ) return
    ipcMain.on( 'gpu.getGPU', async() => gpu.emit( 'getGPU', await gpu.getGPU() ) )
    ipcMain.on('gpu.reset', (data)=> gpu.reset() )
    // ipcMain.on( 'gpu.config.init', async(event,data) => gpu.emit( 'config.init', await gpu.config.init(data) ) )
    // gpu.on('config.init',data => gpu.config.init(data))
    setupIPC( gpu.trex, 'trex' )
    setupIPC( gpu.wildrig, 'wildrig' )
    setupIPC( gpu.config, 'config' )
    gpu.eventsRegistered = true
  },
  async getGPU() {
    try {
      if ( thisPlatform === 'win32' ) {
        await fs.ensureDir( GPUPATH )
        const getName = ( await exec( 'wmic path win32_VideoController get name' ) ).stdout
        if (await fs.exists(path.join( GPUPATH, 'gpuName.txt' ))){
          var gpuName = await fs.readFile( path.join( GPUPATH, 'gpuName.txt' ) ).catch( () => {} )
          if ( gpuName ) gpuName = gpuName.toString()
        } else var gpuName = ""
    
        if ( getName === gpuName ) {
          const exists = await fs.exists( path.join( GPUPATH, 'dxdiag.xml' ) )
          if ( !exists ) await exec( `dxdiag /whql:off /x ${path.join(GPUPATH,'dxdiag.xml')}`, {
            cwd: GPUPATH
          } )
        } else {
          console.log( 'GPU has changed or has not been initialized' )
          gpu.emit( 'status', 'detecting hardware' )
          await fs.writeFile( path.join( GPUPATH, 'gpuName.txt' ), getName )
          await exec( `dxdiag /whql:off /x ${path.join(GPUPATH,'dxdiag.xml')}`, {
            cwd: GPUPATH
          } )
        }
        try {
          await fs.ensureFile( path.join( GPUPATH, 'dxdiag.xml' ) )
          const displayDevices = ( await parseXML( path.join( GPUPATH, 'dxdiag.xml' ) ) ).DxDiag.DisplayDevices
          var gpus = []
          for ( var device of displayDevices ) {
            var thisDevice = {}
            thisDevice.id = device.DisplayDevice[ 0 ].DeviceID[ 0 ]
            thisDevice.name = device.DisplayDevice[ 0 ].ChipType[ 0 ]
            gpus.push( thisDevice )
          }
          // console.log('returning GPUs',gpus)
          return gpus
        } catch ( error ) {
          console.error( error )
          gpu.emit( 'error', 'Problem reading GPU Devices, trying again.' )
          await fs.remove( path.join( GPUPATH, 'dxdiag.xml' ) )
          await fs.remove( path.join( GPUPATH, 'gpuName.txt' ) )
          gpu.emit( 'getGPU', await gpu.getGPU() )
        }

      } else return null
    } catch ( error ) {
      gpu.emit( 'error', error )
      gpu.emit( 'error', 'Problem reading GPU Devices, trying again.' )
      await fs.remove( path.join( GPUPATH, 'dxdiag.xml' ) )
      await fs.remove( path.join( GPUPATH, 'gpuName.txt' ) )
      return gpu.emit( 'getGPU', await gpu.getGPU() )
    }

  },
  async unzip( zipFile, desination ) {
    var unzipper = new unzip( zipFile )
    return new Promise( ( resolve, reject ) => {
      console.log( 'STARTING TO UNZIP' )
      unzipper.on( 'error', function( err ) {
        console.error( 'Caught an error', err )
        reject( err )
      } )

      unzipper.on( 'extract', function( log ) {
        console.log( 'Finished extracting', log )
        resolve( log )
      } )

      unzipper.on( 'progress', function( fileIndex, fileCount ) {
        console.log( 'Extracted file ' + ( fileIndex + 1 ) + ' of ' + fileCount )
      } )

      unzipper.extract( {
        path: desination,
        filter: function( file ) {
          return file.type !== 'SymbolicLink'
        }
      } )
    } )
  },
  trex: {
    async install() {
      gpu.emit( 'status', 'Installing Trex...' )
      try {
        fs.ensureDir(path.join( RESOURCEDIR, 'trex.zip' ))
        const result = await gpu.unzip( path.join( RESOURCEDIR, 'trex.zip' ), TREXPATH )
        console.log( result )
          // gpu.emit( 'status', result )
        return true
      } catch ( error ) {
        gpu.emit( 'error', error )
        console.error( error )
        return false
      }
    },
    async checkInstalled() {
      const result = await fs.exists( path.join( TREXPATH, 't-rex.exe' ) ).catch( console.log )
      if ( !result ) gpu.emit( 'status', 'Trex not installed' )
      return result
    },
    async start() {
      const checkInstall = await gpu.trex.checkInstalled()
      if ( !checkInstall ) {
        const installed = await gpu.trex.install()
        if ( installed ) return gpu.trex.start()
        else return gpu.emit( 'message', 'Unable to start due to install error.' )
      }
      console.log( 'ready to start trex' )
      gpu.emit( 'status', 'starting...' )
      try {
        gpu.shouldBeRunning = true
        if ( gpu.trex.miner && gpu.trex.miner.killed === false ) return gpu.trex.miner.kill()
        gpu.trex.miner = spawn( './t-rex.exe', [ '-c', path.join( TREXPATH, 'boid-trex-config.json' ) ], {
          silent: false,
          cwd: TREXPATH,
          shell: false,
          detached: false,
          env: null
        } )
        gpu.trex.miner.stdout.on( 'data', data => gpu.emit( 'log', data.toString() ) )
        gpu.trex.miner.stderr.on( 'data', data => gpu.emit( 'error', data.toString() ) )
        gpu.trex.miner.on( 'exit', ( code, signal ) => {
          console.log( 'detected close code:', code, signal )
          console.log( 'should be running', gpu.shouldBeRunning )
          gpu.trex.miner.removeAllListeners()
          gpu.trex.miner = null
          if ( gpu.shouldBeRunning ) {
            gpu.emit( 'message', 'The Miner stopped and Boid is restarting it' )
            gpu.trex.start()
          } else {
            gpu.emit( 'message', 'The Miner was stopped' )
            gpu.emit( 'status', 'Stopped' )
              // gpu.emit( 'toggle', false )
          }
        } )
      } catch ( error ) {
        console.error( error )
        gpu.emit( 'error', error )
        return
      }
    },
    async stop() {
      gpu.shouldBeRunning = false
      if ( !gpu.trex.miner ) return gpu.emit( 'toggle', false )
      gpu.trex.miner.kill()
      return 'finished stopping'
    },
    async getStats() {
      try {
        console.log( 'get stats' )
        const stats = ( await ax.get( 'http://127.0.0.1:4067/summary' ) ).data
        if ( stats ) return stats
        else gpu.emit( 'error', 'Error getting t-rex miner stats' )
      } catch ( error ) {
        console.error( 'problem getting trex stats' )
        gpu.emit( 'error', 'problem getting trex stats' )
      }
    },
    config: {
      async verify() {
        await fs.ensureDir( TREXPATH )
        const result = await fs.exists( path.join( TREXPATH, 'boid-trex-config.json' ) ).catch( console.log )
        if ( !result ) gpu.emit( 'status', 'trex config missing' )
        return result
      },

      async init( config ) {
        try {
          const exists = await gpu.trex.config.verify()
          if ( exists ) {
            const currentConfig = await jsonfile.readFile(path.join( TREXPATH, 'boid-trex-config.json' ))
            if (currentConfig.pools[0].user != config.pools[0].user){
              await jsonfile.writeFile( path.join( TREXPATH, 'boid-trex-config.json' ), config )
            }
            gpu.emit( 'trex.config.read', await gpu.trex.config.read() )
            return gpu.emit( 'status', 'trex config exists' )
          } else {
            gpu.emit( 'status', 'initializing trex config...' )
            await jsonfile.writeFile( path.join( TREXPATH, 'boid-trex-config.json' ), config )
            gpu.emit( 'trex.config.read', await gpu.trex.config.read() )
          }
          // gpu.emit('status', 'trex config initialized')
          return 'trex config initialized'
        } catch ( error ) {
          console.error( error )
          gpu.emit( 'error', error )
          return error
        }
      },
      async setIntensity( intensity ) {
        try {
          if ( intensity > 25 || intensity < 8 ) return  u.emit( 'error', 'invalid intensity setting' )
          var config = await jsonfile.readFile( path.join( TREXPATH, 'boid-trex-config.json' ) )
          config.intensity = intensity.toFixed( 2 )
          await jsonfile.writeFile( path.join( TREXPATH, 'boid-trex-config.json' ), config )
          gpu.emit( 'trex.config.read', await gpu.trex.config.read() )
        } catch ( error ) {
          console.error( 'setIntensity Error' )
        }

      },
      async write() {

      },
      async read() {
        try {
          var config = await jsonfile.readFile( path.join( TREXPATH, 'boid-trex-config.json' ) )
          console.log( 'Read trex config' )
          return config
        } catch ( error ) {
          console.log( error )
          gpu.emit( 'error', error )
        }
      }
    }
  },
  wildrig:{
    async install() {
      gpu.emit( 'status', 'Installing Wildrig...' )
      try {
        // await fs.ensureDir(path.join( RESOURCEDIR, 'wildrig.zip' ))
        const result = await gpu.unzip( path.join( RESOURCEDIR, 'wildrig.zip' ), WILDRIGPATH )
        console.log( result )
          // gpu.emit( 'status', result )
        return true
      } catch ( error ) {
        gpu.emit( 'error', 'Error installing wildrig miner!' )
        console.error( error )
        return false
      }
    },
    async checkInstalled() {
      const result = await fs.exists( path.join( WILDRIGPATH, 'wildrig.exe' ) ).catch( console.log )
      if ( !result ) gpu.emit( 'status', 'wildrig not installed' )
      return result
    },
    async start() {
      const checkInstall = await gpu.wildrig.checkInstalled()
      if ( !checkInstall ) {
        const installed = await gpu.wildrig.install()
        if ( installed ) return gpu.wildrig.start()
        else return gpu.emit( 'message', 'Unable to start due to install error.' )
      }
      console.log( 'ready to start wildrig' )
      gpu.emit( 'status', 'starting...' )
      try {
        gpu.shouldBeRunning = true
        if ( gpu.wildrig.miner && gpu.wildrig.miner.killed === false ) return gpu.wildrig.miner.kill()
        gpu.wildrig.miner = spawn( './wildrig.exe', await gpu.wildrig.config.read(), {
          silent: false,
          cwd: WILDRIGPATH,} )
        gpu.wildrig.miner.stdout.on( 'data', data => gpu.emit( 'log', data.toString() ) )
        gpu.wildrig.miner.stderr.on( 'data', data => gpu.emit( 'error', data.toString() ) )
        gpu.wildrig.miner.on( 'exit', ( code, signal ) => {
          console.log( 'detected close code:', code, signal )
          console.log( 'should be running', gpu.shouldBeRunning )
          gpu.wildrig.miner.removeAllListeners()
          gpu.wildrig.miner = null
          if ( gpu.shouldBeRunning ) {
            gpu.emit( 'message', 'The Miner stopped and Boid is restarting it' )
            gpu.wildrig.start()
          } else {
            gpu.emit( 'message', 'The Miner was stopped' )
            gpu.emit( 'status', 'Stopped' )
            gpu.emit( 'toggle', false )
          }
        } )
      } catch ( error ) {
        console.error( error )
        gpu.emit( 'error', error )
        return
      }
    },
    async stop() {
      gpu.shouldBeRunning = false
      if ( !gpu.wildrig.miner ) return gpu.emit( 'toggle', false )
      gpu.wildrig.miner.kill()
      return 'finished stopping'
    },
    async getStats() {
      try {
        console.log( 'get stats' )
        const stats = ( await ax.get( 'http://127.0.0.1:4068' ) ).data
        if ( stats ) return stats
        else gpu.emit( 'error', 'Error getting wildrig miner stats' )
      } catch ( error ) {
        console.error( 'problem getting wildrig stats' )
        gpu.emit( 'error', 'problem getting wildrig stats' )
      }
    },
    config: {
      async verify() {
        await fs.ensureDir( WILDRIGPATH )
        const result = await fs.exists( path.join( WILDRIGPATH, 'boid-wildrig-config.json' ) ).catch( console.log )
        if ( !result ) gpu.emit( 'status', 'wildrig config missing' )
        return result
      },
      async init( config ) {
        try {
          const exists = await gpu.wildrig.config.verify()
          if ( exists ) {
            const currentConfig = await gpu.wildrig.config.read()
            if (currentConfig[0] != config[0]){
              await jsonfile.writeFile( path.join( WILDRIGPATH, 'boid-wildrig-config.json' ), config )
            }
            gpu.emit( 'wildrig.config.read', await gpu.wildrig.config.read() )
            return gpu.emit( 'status', 'wildrig config exists' )
          } else {
            gpu.emit( 'status', 'initializing wildrig config...' )
            await jsonfile.writeFile( path.join( WILDRIGPATH, 'boid-wildrig-config.json' ), config )
            gpu.emit( 'wildrig.config.read', await gpu.wildrig.config.read() )
          }
          return 'wildrig config initialized'
        } catch ( error ) {
          console.error( error )
          gpu.emit( 'error', error )
          return error
        }
      },
      async setIntensity( intensity ) {
        try {
          if ( intensity > 20 || intensity < 10 ) return gpu.emit( 'error', 'invalid intensity setting' )
          var configArray = await jsonfile.readFile( path.join( WILDRIGPATH, 'boid-wildrig-config.json' ) )
          const index = configArray.findIndex(el => {
            el = el.split('=')
            el[0] = el[0].replace('--','')
            return el[0] === 'opencl-launch'
          })
          configArray[index] = '--opencl-launch=' + intensity.toFixed(2) + 'x0'
          await jsonfile.writeFile( path.join( WILDRIGPATH, 'boid-wildrig-config.json' ), configArray )
          gpu.emit( 'wildrig.config.read', await gpu.wildrig.config.read() )
        } catch ( error ) {
          console.error( 'setIntensity Error' )
        }

      },

      async read() {
        try {
          var config = await jsonfile.readFile( path.join( WILDRIGPATH, 'boid-wildrig-config.json' ) )
          console.log( 'Read wildrig config' )
          return config
        } catch ( error ) {
          await fs.remove(path.join( WILDRIGPATH, 'boid-wildrig-config.json' ))
          console.log( error )
          gpu.emit( 'error', error )
          return null
        }
      }
    }
  }


}


ipcMain.on( 'gpu.init', gpu.init )

module.exports = gpu