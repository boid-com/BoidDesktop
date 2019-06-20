const icongen = require('icon-gen')

const options = {
  report: true,
  ico: {
    name: 'app',
    sizes: [16, 24, 32, 48, 64, 128, 256]
  },
  icns: {
    name: 'app',
    sizes:  [16, 32, 64, 128, 256, 512, 1024]
  },
  favicon: {
    name: 'favicon-',
    sizes:  [32, 57, 72, 96, 120, 128, 144, 152, 195, 228],
    ico: [16, 24, 32, 48, 64]
  }
};

return icongen('./logo.png', '../', options)
.then((results) => {
  console.log(results)
}).catch((err)=>console.error(err.message))
