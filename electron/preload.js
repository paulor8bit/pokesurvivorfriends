const { contextBridge, ipcRenderer } = require('electron');

// Only the local desktop shell receives this API; no Node access in the game.
contextBridge.exposeInMainWorld('desktop', {
  getState: () => ipcRenderer.invoke('desktop:state'),
  retry: () => ipcRenderer.invoke('desktop:retry'),
  copySite: () => ipcRenderer.invoke('desktop:copy-site'),
  onState(callback) {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('desktop:state-changed', listener);
    return () => ipcRenderer.removeListener('desktop:state-changed', listener);
  }
});
