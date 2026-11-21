const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('focusDesktop', {
  minimize: () => ipcRenderer.send('window:minimize'),
  glassWallpaper: () => ipcRenderer.invoke('window:glass-wallpaper'),
  close: () => ipcRenderer.send('window:close'),
  setAlwaysOnTop: (value) => ipcRenderer.send('window:set-always-on-top', value),
  setOpacity: (value) => ipcRenderer.send('window:set-opacity', value),
  setMode: (mode) => ipcRenderer.send('window:set-mode', mode),
  onNavigateView: (callback) => {
    const listener = (_event, view) => callback(view)
    ipcRenderer.on('navigate:view', listener)
    return () => ipcRenderer.removeListener('navigate:view', listener)
  },
  onWorkspaceChanged: (callback) => {
    const listener = () => callback()
    ipcRenderer.on('workspace:changed', listener)
    return () => ipcRenderer.removeListener('workspace:changed', listener)
  },
  setTheme: (mode) => ipcRenderer.send('theme:set', mode),
  onTheme: (callback) => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on('theme:apply', listener)
    return () => ipcRenderer.removeListener('theme:apply', listener)
  },
  syncReminders: (payload) => ipcRenderer.send('reminders:sync', payload),
  testReminder: () => ipcRenderer.send('reminders:test'),
  notify: (payload) => ipcRenderer.send('app:notify', payload),
  setWidgetEnabled: (enabled) => ipcRenderer.send('widget:set-enabled', enabled),
  exportPersonal: (kind) => ipcRenderer.invoke('personal:export', kind),
  importPersonal: () => ipcRenderer.invoke('personal:import'),
  widget: {
    read: () => ipcRenderer.invoke('widget:read'),
    toggle: (id) => ipcRenderer.invoke('widget:toggle', id),
    toggleHabit: (habitId, day) => ipcRenderer.invoke('widget:toggle-habit', { habitId, day }),
    resize: (width, height) => ipcRenderer.send('widget:resize', { width, height }),
    appearance: (prefs) => ipcRenderer.send('widget:appearance', prefs),
    add: (title) => ipcRenderer.invoke('widget:add', title),
    openMain: (view) => ipcRenderer.send('widget:open-main', view),
    close: () => ipcRenderer.send('widget:close'),
    onData: (callback) => {
      const listener = (_event, payload) => callback(payload)
      ipcRenderer.on('widget:data', listener)
      return () => ipcRenderer.removeListener('widget:data', listener)
    },
  },
  workspace: {
    read: () => ipcRenderer.invoke('workspace:read'),
    write: (data) => ipcRenderer.invoke('workspace:write', data),
  },
  appVersion: () => ipcRenderer.invoke('app:version'),
  setZoom: (value) => ipcRenderer.invoke('ui:set-zoom', value),
  gitee: {
    get: () => ipcRenderer.invoke('gitee:get'),
    set: (config) => ipcRenderer.invoke('gitee:set', config),
  },
  profile: {
    read: () => ipcRenderer.invoke('profile:read'),
    write: (raw) => ipcRenderer.invoke('profile:write', raw),
    list: () => ipcRenderer.invoke('profile:list'),
    create: (name) => ipcRenderer.invoke('profile:create', name),
    switchTo: (id) => ipcRenderer.invoke('profile:switch', id),
    rename: (id, name) => ipcRenderer.invoke('profile:rename', { id, name }),
    remove: (id) => ipcRenderer.invoke('profile:delete', id),
    exportFile: (id) => ipcRenderer.invoke('profile:export', id),
    importFile: () => ipcRenderer.invoke('profile:import'),
    reveal: () => ipcRenderer.invoke('profile:reveal'),
  },
})
