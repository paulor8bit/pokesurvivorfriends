const path = require('node:path');
const { ensureCloudflared } = require('../server/online-session');

ensureCloudflared({ runtimeDir: path.resolve(__dirname, '../.runtime') })
  .then(() => console.log('Acesso online pronto para incluir no aplicativo.'))
  .catch(error => { console.error(error.message); process.exitCode = 1; });
