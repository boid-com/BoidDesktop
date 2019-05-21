const boinc = require('./boinc')
var cpu = {
  async init(){
    await boinc.init()
  }
}

module.exports = cpu