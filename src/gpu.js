const os = require('os')
const thisPlatform = os.platform()
var unzip = require('decompress-zip')
const {exec,spawn} = require('child-process-promise')
import { ipcMain } from 'electron'

var gpu = {
    window:null,
    init(appWindow){
        gpu.window = appWindow
    },
    emit(label,data){
        if (!window) return
        gpu.window.webContents.send('gpu.'+label, data)

    },
    async getGPU(){
        if (thisPlatform === 'win32'){
            const gpu = (await exec('wmic path win32_VideoController get name')).stdout
            console.log(gpu)
            ipcMain.emit('gpu',gpu)
        }
    },
    installTRex(){
        
    },
    startTRex() {

    }
}

// gpu.getGPU()

module.exports = gpu