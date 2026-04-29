const settingsBridge = (window as any).api as {
  getSettings: () => Promise<{
    globalShortcutEnabled: boolean
    globalShortcutKey: string
    apiKey: string
    model: string
    githubToken: string
  }>
  saveSettings: (patch: Record<string, unknown>) => void
  dismiss: () => void
  testGitHub: () => Promise<string>
  startGitHubAuth: () => Promise<{ user_code?: string; verification_uri?: string; error?: string }>
  cancelGitHubAuth: () => void
  disconnectGitHub: () => void
  onGitHubConnected: (cb: () => void) => void
  onGitHubAuthError: (cb: (msg: string) => void) => void
}

const apiKeyInput       = document.getElementById('api-key') as HTMLInputElement
const modelInput        = document.getElementById('model') as HTMLInputElement
const toggle            = document.getElementById('shortcut-toggle') as HTMLInputElement
const revealBtn         = document.getElementById('toggle-reveal') as HTMLButtonElement
const saveBtn           = document.getElementById('save') as HTMLButtonElement

// GitHub OAuth elements
const githubDisconnected    = document.getElementById('github-disconnected') as HTMLElement
const githubWaiting         = document.getElementById('github-waiting') as HTMLElement
const githubConnectedState  = document.getElementById('github-connected-state') as HTMLElement
const githubConnectBtn      = document.getElementById('github-connect') as HTMLButtonElement
const githubCancelBtn       = document.getElementById('github-cancel') as HTMLButtonElement
const githubDisconnectBtn   = document.getElementById('github-disconnect') as HTMLButtonElement
const githubUserCode        = document.getElementById('github-user-code') as HTMLElement
const githubUsernameDisplay = document.getElementById('github-username-display') as HTMLElement
const githubStatus          = document.getElementById('github-status') as HTMLDivElement

revealBtn.addEventListener('click', () => {
  const isHidden = apiKeyInput.type === 'password'
  apiKeyInput.type = isHidden ? 'text' : 'password'
  revealBtn.textContent = isHidden ? 'Hide' : 'Show'
})

function setGitHubState(state: 'disconnected' | 'waiting' | 'connected', username = '') {
  githubDisconnected.style.display   = state === 'disconnected' ? '' : 'none'
  githubWaiting.style.display        = state === 'waiting'      ? '' : 'none'
  githubConnectedState.style.display = state === 'connected'    ? '' : 'none'
  if (state === 'connected' && username) {
    githubUsernameDisplay.textContent = `@${username}`
  }
  githubStatus.className = 'github-status'
  githubStatus.textContent = ''
}

async function init() {
  const settings = await settingsBridge.getSettings()
  apiKeyInput.value = settings.apiKey || ''
  modelInput.value  = settings.model  || 'openai/gpt-4o-mini'
  toggle.checked    = settings.globalShortcutEnabled

  if (settings.githubToken) {
    // Fetch username to show in connected state
    try {
      const result = await settingsBridge.testGitHub()
      const match = result.match(/Connected as @(\S+)/)
      setGitHubState('connected', match?.[1] ?? '')
    } catch {
      setGitHubState('disconnected')
    }
  } else {
    setGitHubState('disconnected')
  }
}

githubConnectBtn.addEventListener('click', async () => {
  githubConnectBtn.disabled = true
  githubConnectBtn.textContent = 'Connecting...'

  const result = await settingsBridge.startGitHubAuth()

  if (result.error) {
    githubConnectBtn.disabled = false
    githubConnectBtn.innerHTML = `<svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg> Connect with GitHub`
    githubStatus.className = 'github-status visible err'
    githubStatus.textContent = result.error
    return
  }

  githubUserCode.textContent = result.user_code ?? ''
  setGitHubState('waiting')
})

githubCancelBtn.addEventListener('click', () => {
  settingsBridge.cancelGitHubAuth()
  setGitHubState('disconnected')
  githubConnectBtn.disabled = false
})

githubDisconnectBtn.addEventListener('click', () => {
  settingsBridge.disconnectGitHub()
  setGitHubState('disconnected')
})

settingsBridge.onGitHubConnected(async () => {
  const result = await settingsBridge.testGitHub()
  const match = result.match(/Connected as @(\S+)/)
  setGitHubState('connected', match?.[1] ?? '')
})

settingsBridge.onGitHubAuthError((msg) => {
  setGitHubState('disconnected')
  githubStatus.className = 'github-status visible err'
  githubStatus.textContent = `Authorization failed: ${msg}`
})

saveBtn.addEventListener('click', () => {
  settingsBridge.saveSettings({
    apiKey:                apiKeyInput.value.trim(),
    model:                 modelInput.value.trim() || 'openai/gpt-4o-mini',
    globalShortcutEnabled: toggle.checked,
  })
  settingsBridge.dismiss()
})

init()
