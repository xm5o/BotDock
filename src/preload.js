const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('botdock', {
  listProjects: () => ipcRenderer.invoke('projects:list'),
  pickFolder: () => ipcRenderer.invoke('projects:pick-folder'),
  saveProject: project => ipcRenderer.invoke('projects:save', project),
  removeProject: id => ipcRenderer.invoke('projects:remove', id),
  start: project => ipcRenderer.invoke('process:start', project),
  stop: id => ipcRenderer.invoke('process:stop', id),
  restart: project => ipcRenderer.invoke('process:restart', project),
  logs: id => ipcRenderer.invoke('process:logs', id),
  install: project => ipcRenderer.invoke('process:install', project),
  openFolder: folder => ipcRenderer.invoke('project:open-folder', folder),
  readEnv: folder => ipcRenderer.invoke('env:read', folder),
  writeEnv: (folder, content) => ipcRenderer.invoke('env:write', folder, content),
  onLog: callback => ipcRenderer.on('process-log', (_event, data) => callback(data)),
  onStatus: callback => ipcRenderer.on('process-status', (_event, data) => callback(data)),
  onStats: callback => ipcRenderer.on('process-stats', (_event, data) => callback(data))
});
