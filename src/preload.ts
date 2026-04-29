import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  // check-in window
  submit: (text: string) => ipcRenderer.send('submit-checkin', text),
  dismiss: () => ipcRenderer.send('dismiss-window'),
  onQuestion: (callback: (question: string) => void) => {
    ipcRenderer.on('set-question', (_event, question) => callback(question))
  },

  // settings window
  openSettings: () => ipcRenderer.send('open-settings'),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (patch: Record<string, unknown>) => ipcRenderer.send('save-settings', patch),
})
