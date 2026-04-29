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
  testGitHub: () => ipcRenderer.invoke('test-github'),

  // GitHub OAuth Device Flow
  startGitHubAuth: () => ipcRenderer.invoke('github-device-start'),
  cancelGitHubAuth: () => ipcRenderer.send('github-device-cancel'),
  disconnectGitHub: () => ipcRenderer.send('github-disconnect'),
  onGitHubConnected: (cb: () => void) => ipcRenderer.on('github-connected', cb),
  onGitHubAuthError: (cb: (msg: string) => void) => ipcRenderer.on('github-auth-error', (_e, msg) => cb(msg)),
})
