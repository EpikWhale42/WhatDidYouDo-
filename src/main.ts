import * as dotenv from 'dotenv'
import * as path from 'path'
dotenv.config({ path: path.join(__dirname, '..', '.env') })

import {
  app, BrowserWindow, Tray, Menu, nativeImage,
  ipcMain, shell, globalShortcut,
} from 'electron'
import * as fs from 'fs'
import * as os from 'os'
import { generateQuestion, processResponse, getAgentLogPath, answerQuery, summarizeLogs } from './ai'
import { loadSettings, saveSettings } from './settings'

let tray: Tray | null = null
let checkinWindow: BrowserWindow | null = null
let settingsWindow: BrowserWindow | null = null
let timer: NodeJS.Timeout | null = null
let pendingQuestion = 'What did you do in the last hour?'
let questionAnswered = true

const LOG_DIR = path.join(os.homedir(), 'Documents', 'WhatDidYouDo-Logs')
const CHECK_INTERVAL_MS = 60 * 60 * 1000 // 1 hour
// For testing, you can set it to 1 minute:
// const CHECK_INTERVAL_MS = 60 * 1000

function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true })
}

function getTodayLogPath(): string {
  return path.join(LOG_DIR, `${new Date().toISOString().split('T')[0]}.md`)
}

function appendToUserLog(entry: string) {
  ensureLogDir()
  const logPath = getTodayLogPath()
  const now = new Date()
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  const isNew = !fs.existsSync(logPath)
  const header = isNew
    ? `# ${now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}\n\n`
    : ''
  fs.appendFileSync(logPath, `${header}## ${timeStr}\n\n${entry}\n\n---\n\n`, 'utf8')
}

function isSnoozed(): boolean {
  return loadSettings().snoozeUntil > Date.now()
}

function updateTray(snoozeMinutes = 0) {
  if (!tray) return
  if (snoozeMinutes > 0) {
    const until = new Date(Date.now() + snoozeMinutes * 60 * 1000)
    const untilStr = until.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    tray.setTitle(' ⏸')
    tray.setToolTip(`What Did You Do? — Snoozed until ${untilStr}`)
  } else {
    tray.setTitle('')
    tray.setToolTip('What Did You Do?')
  }
}

function makeWindow(opts: Electron.BrowserWindowConstructorOptions): BrowserWindow {
  return new BrowserWindow({
    resizable: false,
    alwaysOnTop: true,
    center: true,
    titleBarStyle: 'hiddenInset',
    transparent: true,
    vibrancy: 'under-window',
    visualEffectState: 'active',
    roundedCorners: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
    },
    ...opts,
  })
}

async function openCheckinWindow() {
  if (checkinWindow && !checkinWindow.isDestroyed()) {
    checkinWindow.focus()
    return
  }

  checkinWindow = makeWindow({ width: 620, height: 460 })
  checkinWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'))

  checkinWindow.webContents.on('did-finish-load', async () => {
    checkinWindow?.webContents.send('set-question', pendingQuestion)

    if (questionAnswered) {
      questionAnswered = false
      try {
        const aiQuestion = await generateQuestion(getTodayLogPath())
        pendingQuestion = aiQuestion
        if (checkinWindow && !checkinWindow.isDestroyed()) {
          checkinWindow.webContents.send('set-question', aiQuestion)
        }
      } catch {}
    }
  })

  checkinWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return
    if (input.key === 'Escape' || (input.key === 'w' && input.meta)) {
      checkinWindow?.close()
      event.preventDefault()
    }
  })

  checkinWindow.on('closed', () => { checkinWindow = null })
}

function openSettingsWindow() {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.focus()
    return
  }
  settingsWindow = makeWindow({ width: 460, height: 400 })
  settingsWindow.loadFile(path.join(__dirname, 'renderer', 'settings.html'))
  settingsWindow.on('closed', () => { settingsWindow = null })
}

function openTodayLog() {
  ensureLogDir()
  const logPath = getTodayLogPath()
  if (!fs.existsSync(logPath)) fs.writeFileSync(logPath, `# ${new Date().toDateString()}\n\n`, 'utf8')
  shell.openPath(logPath)
}

function openAgentLog() {
  ensureLogDir()
  const logPath = getAgentLogPath()
  if (!fs.existsSync(logPath)) fs.writeFileSync(logPath, `# Agent Log — ${new Date().toDateString()}\n\n`, 'utf8')
  shell.openPath(logPath)
}

function applyShortcut() {
  globalShortcut.unregisterAll()
  const settings = loadSettings()
  if (settings.globalShortcutEnabled) {
    globalShortcut.register(settings.globalShortcutKey, openCheckinWindow)
  }
}

function startTimer() {
  if (timer) clearInterval(timer)
  timer = setInterval(() => {
    if (isSnoozed()) return // respect user's DND request
    questionAnswered = true
    openCheckinWindow()
  }, CHECK_INTERVAL_MS)
}

function createTray() {
  // In packaged app assets land in Resources/assets; in dev they're in dist/assets
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, 'assets', 'icon.png')
    : path.join(__dirname, 'assets', 'icon.png')
  const icon = nativeImage.createFromPath(iconPath).resize({ width: 18, height: 18 })
  icon.setTemplateImage(true) // adapts to dark/light menu bar automatically
  tray = new Tray(icon)
  tray.setToolTip('What Did You Do?')

  const menu = Menu.buildFromTemplate([
    { label: 'Check In Now', click: openCheckinWindow },
    { type: 'separator' },
    { label: "Open Today's Log", click: openTodayLog },
    { label: 'Open Agent Log', click: openAgentLog },
    { type: 'separator' },
    { label: 'Settings', click: openSettingsWindow },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ])

  tray.setContextMenu(menu)
}

app.whenReady().then(() => {
  if (app.dock) app.dock.hide()
  createTray()
  applyShortcut()
  // Restore tray snooze indicator if app restarted during a snooze
  if (isSnoozed()) {
    const remaining = Math.round((loadSettings().snoozeUntil - Date.now()) / 60000)
    updateTray(remaining)
  }
  startTimer()
  openCheckinWindow()
})

app.on('will-quit', () => globalShortcut.unregisterAll())

// --- IPC ---

ipcMain.on('submit-checkin', async (_event, text: string) => {
  const answer = text.trim()
  if (answer) {
    questionAnswered = true
    appendToUserLog(answer)
    processResponse(pendingQuestion, answer)
      .then(({ snoozeMinutes }) => {
        if (snoozeMinutes > 0) {
          saveSettings({ snoozeUntil: Date.now() + snoozeMinutes * 60 * 1000 })
          updateTray(snoozeMinutes)
        } else {
          saveSettings({ snoozeUntil: 0 })
          updateTray(0)
        }
      })
      .catch(console.error)
  }
  checkinWindow?.close()
})

ipcMain.on('dismiss-window', () => {
  checkinWindow?.close()
  settingsWindow?.close()
})

ipcMain.on('ask-query', async (_event, query: string) => {
  const answer = await answerQuery(query)
  checkinWindow?.webContents.send('set-answer', answer)
})

ipcMain.on('summarize-query', async (_event, hours: number | undefined) => {
  const summary = await summarizeLogs(hours)
  checkinWindow?.webContents.send('set-answer', summary)
})

ipcMain.on('open-settings', openSettingsWindow)
ipcMain.handle('get-settings', () => loadSettings())

ipcMain.on('save-settings', (_event, patch: Record<string, unknown>) => {
  saveSettings(patch)
  applyShortcut()
})

app.on('window-all-closed', () => { /* keep running */ })
