const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getServerPort: () => ipcRenderer.invoke('get-server-port'),
  minimizeToTray: () => ipcRenderer.invoke('minimize-to-tray'),
  getAppInfo: () => ipcRenderer.invoke('get-app-info'),

  send: (channel, data) => {
    const validChannels = ['to-main'];
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    }
  }
});
