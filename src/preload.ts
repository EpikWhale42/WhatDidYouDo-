import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  // check-in window
  submit: (text: string) => ipcRenderer.send('submit-checkin', text),
  dismiss: () => ipcRenderer.send('dismiss-window'),
  onQuestion: (callback: (question: string) => void) => {
    ipcRenderer.on('set-question', (_event, question) => callback(question))
  },

  // /ask sigil
  ask: (query: string) => ipcRenderer.send('ask-query', query),

  // /summary sigil
  summarize: (hours?: number) => ipcRenderer.send('summarize-query', hours),

  onAnswer: (callback: (answer: string) => void) => {
    ipcRenderer.on('set-answer', (_event, answer) => callback(answer))
  },

  // settings window
  openSettings: () => ipcRenderer.send('open-settings'),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (patch: Record<string, unknown>) => ipcRenderer.send('save-settings', patch),
})
