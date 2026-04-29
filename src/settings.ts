import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

const SETTINGS_PATH = path.join(
  os.homedir(),
  'Documents',
  'WhatDidYouDo-Logs',
  'settings.json'
)

export interface Settings {
  globalShortcutEnabled: boolean
  globalShortcutKey: string
  snoozeUntil: number // unix ms timestamp, 0 = not snoozed
  apiKey: string
  model: string
  githubToken: string
}

const DEFAULTS: Settings = {
  globalShortcutEnabled: true,
  globalShortcutKey: 'CommandOrControl+Shift+N',
  snoozeUntil: 0,
  apiKey: '',
  model: 'openai/gpt-4o-mini',
  githubToken: '',
}

export function loadSettings(): Settings {
  try {
    if (fs.existsSync(SETTINGS_PATH)) {
      return { ...DEFAULTS, ...JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8')) }
    }
  } catch {}
  return { ...DEFAULTS }
}

export function saveSettings(patch: Partial<Settings>): Settings {
  const updated = { ...loadSettings(), ...patch }
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(updated, null, 2), 'utf8')
  return updated
}
