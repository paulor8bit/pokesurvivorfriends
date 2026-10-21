const { app, BrowserWindow, Menu, ipcMain, clipboard, shell, session } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');
const { createOnlineSession } = require('../server/online-session');

let win = null, online = null, quitting = false;
let windowReady = false;
function notifyLauncher() {
  const marker = process.env.POKESURVIVOR_STARTUP_FILE;
  if (!marker || !windowReady || !online?.state.localUrl) return;
  try {
    fs.writeFileSync(marker, JSON.stringify({ ready: true, pid: process.pid }));
    delete process.env.POKESURVIVOR_STARTUP_FILE;
  } catch (error) { console.error('Startup handoff:', error.message); }
}
const launcherUrl = pathToFileURL(path.join(__dirname, 'launcher.html')).href;
const testMode = process.env.POKESURVIVOR_TEST === '1';
if (process.env.POKESURVIVOR_USER_DATA) app.setPath('userData', process.env.POKESURVIVOR_USER_DATA);
// Keep the existing development/installed save path when the display name changes.
else app.setPath('userData', path.join(app.getPath('appData'), 'PokéSurvivor'));
if (testMode && process.env.POKESURVIVOR_TEST_PROFILE) app.setPath('userData', process.env.POKESURVIVOR_TEST_PROFILE);

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.show(); win.focus(); } });
  app.whenReady().then(async () => {
    Menu.setApplicationMenu(null);
    app.setAppUserModelId('com.pokesurvivor.app');
    const desktopSession = session.fromPartition('persist:pokesurvivor');
    desktopSession.setPermissionRequestHandler((contents, permission, callback, details) => {
      let ownGame = false;
      try { ownGame = new URL(details.requestingUrl || '').origin === new URL(online.state.localUrl).origin; } catch { /* not the game */ }
      callback(ownGame && ['fullscreen', 'clipboard-sanitized-write'].includes(permission));
    });
    desktopSession.setPermissionCheckHandler((contents, permission, origin) => {
      try { return new URL(origin).origin === new URL(online.state.localUrl).origin && ['fullscreen', 'clipboard-sanitized-write'].includes(permission); }
      catch { return false; }
    });
    win = new BrowserWindow({ width: 1280, height: 850, minWidth: 860, minHeight: 600,
      title: 'PokeSuvivor Friends', backgroundColor: '#081328', show: false,
      icon: path.join(app.getAppPath(), 'assets/icons/icon-512.png'),
      webPreferences: { preload: path.join(__dirname, 'preload.js'), partition: 'persist:pokesurvivor',
        contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true, webviewTag: false,
        backgroundThrottling: false }
    });
    const trusted = event => event.sender === win?.webContents && event.senderFrame?.url === launcherUrl;
    ipcMain.handle('desktop:state', event => { if (trusted(event)) return online.state; });
    ipcMain.handle('desktop:retry', event => { if (trusted(event)) return online.start(); });
    ipcMain.handle('desktop:copy-site', event => {
      if (!trusted(event) || !online.state.publicUrl) return false;
      clipboard.writeText(online.state.publicUrl); return true;
    });
    win.webContents.setWindowOpenHandler(({ url }) => {
      if (/^https?:\/\//i.test(url)) shell.openExternal(url);
      return { action: 'deny' };
    });
    win.webContents.on('will-navigate', event => { if (event.url !== launcherUrl) event.preventDefault(); });
    win.webContents.on('will-frame-navigate', event => {
      if (event.isMainFrame) return;
      let allowed = false;
      try { allowed = new URL(event.url).origin === new URL(online.state.localUrl).origin; } catch { /* invalid target */ }
      if (!allowed) event.preventDefault();
    });
    win.on('ready-to-show', () => { if (!testMode) win.show(); windowReady = true; notifyLauncher(); });
    win.on('closed', () => { win = null; app.quit(); });
    online = createOnlineSession({ root: app.getAppPath(),
      port: Number(process.env.POKESURVIVOR_PORT) || 8790,
      runtimeDir: path.join(app.getPath('userData'), 'online-runtime'),
      binaryPath: app.isPackaged ? path.join(process.resourcesPath, 'tunnel/cloudflared.exe')
        : path.join(app.getAppPath(), '.runtime/cloudflared-windows-amd64.exe'),
      onState: state => { if (win && !win.isDestroyed()) win.webContents.send('desktop:state-changed', state); }
    });
    await win.loadURL(launcherUrl);
    await online.start();
    notifyLauncher();
  }).catch(error => {
    require('electron').dialog.showErrorBox('Não foi possível abrir o PokeSuvivor Friends', error.message);
    app.quit();
  });
  app.on('window-all-closed', () => app.quit());
  app.on('before-quit', event => {
    if (quitting) return;
    event.preventDefault(); quitting = true;
    Promise.resolve(online?.stop()).finally(() => app.quit());
  });
}
