const settingsBridge = (window as any).api as {
  getSettings: () => Promise<{
    globalShortcutEnabled: boolean
    globalShortcutKey: string
    apiKey: string
    model: string
  }>
  saveSettings: (patch: Record<string, unknown>) => void
  dismiss: () => void
}

const apiKeyInput   = document.getElementById('api-key') as HTMLInputElement
const modelInput    = document.getElementById('model') as HTMLInputElement
const toggle        = document.getElementById('shortcut-toggle') as HTMLInputElement
const revealBtn     = document.getElementById('toggle-reveal') as HTMLButtonElement
const saveBtn       = document.getElementById('save') as HTMLButtonElement

// Show/hide API key
revealBtn.addEventListener('click', () => {
  const isHidden = apiKeyInput.type === 'password'
  apiKeyInput.type = isHidden ? 'text' : 'password'
  revealBtn.textContent = isHidden ? 'Hide' : 'Show'
})

async function init() {
  const settings = await settingsBridge.getSettings()
  apiKeyInput.value = settings.apiKey || ''
  modelInput.value  = settings.model  || 'openai/gpt-4o-mini'
  toggle.checked    = settings.globalShortcutEnabled
}

saveBtn.addEventListener('click', () => {
  settingsBridge.saveSettings({
    apiKey: apiKeyInput.value.trim(),
    model: modelInput.value.trim() || 'openai/gpt-4o-mini',
    globalShortcutEnabled: toggle.checked,
  })
  settingsBridge.dismiss()
})

init()
