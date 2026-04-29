const checkinBridge = (window as any).api as {
  submit: (text: string) => void
  dismiss: () => void
  onQuestion: (callback: (question: string) => void) => void
  openSettings: () => void
  ask: (query: string) => void
  summarize: (hours?: number) => void
  onAnswer: (callback: (answer: string) => void) => void
}

function inlineMd(text: string): string {
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
}

function renderMarkdown(text: string): string {
  const lines = text.split('\n')
  const out: string[] = []
  let inUl = false
  let inOl = false

  const closeList = () => {
    if (inUl) { out.push('</ul>'); inUl = false }
    if (inOl) { out.push('</ol>'); inOl = false }
  }

  for (const raw of lines) {
    const line = raw.trimEnd()

    if (/^###\s/.test(line))      { closeList(); out.push(`<h3>${inlineMd(line.slice(4))}</h3>`); continue }
    if (/^##\s/.test(line))       { closeList(); out.push(`<h2>${inlineMd(line.slice(3))}</h2>`); continue }
    if (/^#\s/.test(line))        { closeList(); out.push(`<h1>${inlineMd(line.slice(2))}</h1>`); continue }

    const ulMatch = line.match(/^([•\-\*])\s(.*)/)
    if (ulMatch) {
      if (!inUl) { closeList(); out.push('<ul>'); inUl = true }
      out.push(`<li>${inlineMd(ulMatch[2])}</li>`)
      continue
    }

    const olMatch = line.match(/^\d+\.\s(.*)/)
    if (olMatch) {
      if (!inOl) { closeList(); out.push('<ol>'); inOl = true }
      out.push(`<li>${inlineMd(olMatch[1])}</li>`)
      continue
    }

    closeList()
    if (line.trim() === '') { out.push('<br>'); continue }
    out.push(`<p>${inlineMd(line)}</p>`)
  }

  closeList()
  return out.join('')
}

const questionEl  = document.getElementById('question') as HTMLElement
const subtitleEl  = document.getElementById('subtitle') as HTMLElement
const input       = document.getElementById('input') as HTMLTextAreaElement
const skeleton      = document.getElementById('skeleton') as HTMLElement
const answerDisplay = document.getElementById('answer-display') as HTMLElement
const submitBtn   = document.getElementById('submit') as HTMLButtonElement
const dismissBtn  = document.getElementById('dismiss') as HTMLButtonElement
const settingsBtn = document.getElementById('settings') as HTMLButtonElement
const cmdChipRow  = document.getElementById('cmd-chip-row') as HTMLElement
const cmdChipX    = document.getElementById('cmd-chip-x') as HTMLButtonElement
const sigilMenu   = document.getElementById('sigil-menu') as HTMLElement

type Mode = 'normal' | 'loading' | 'answered'
type InputMode = 'normal' | 'sigil' | 'ask'

let inputMode: InputMode = 'normal'

function activateAskMode(query = '') {
  inputMode = 'ask'
  sigilMenu.classList.remove('visible')
  cmdChipRow.classList.add('visible')
  input.value = query
  input.placeholder = 'What do you want to know?'
  input.focus()
}

function deactivateAskMode() {
  inputMode = 'normal'
  cmdChipRow.classList.remove('visible')
  sigilMenu.classList.remove('visible')
  input.value = ''
  input.placeholder = 'e.g. Fixed the auth bug, reviewed two PRs, synced with design...'
  input.focus()
}

function setMode(mode: Mode) {
  if (mode === 'normal') {
    input.style.display = ''
    answerDisplay.classList.remove('visible')
    skeleton.classList.remove('visible')
    input.readOnly = false
    submitBtn.textContent = 'Log it'
    submitBtn.disabled = false
    dismissBtn.style.display = ''
    subtitleEl.textContent = 'Saved to your daily log.'
    deactivateAskMode()
  } else if (mode === 'loading') {
    input.style.display = 'none'
    answerDisplay.classList.remove('visible')
    skeleton.classList.add('visible')
    submitBtn.textContent = 'Searching...'
    submitBtn.disabled = true
    dismissBtn.style.display = 'none'
    subtitleEl.textContent = 'Searching your logs...'
  } else if (mode === 'answered') {
    input.style.display = 'none'
    answerDisplay.classList.add('visible')
    skeleton.classList.remove('visible')
    cmdChipRow.classList.remove('visible')
    inputMode = 'normal'
    submitBtn.textContent = 'Done'
    submitBtn.disabled = false
    dismissBtn.style.display = 'none'
    subtitleEl.textContent = 'Answer from your logs.'
  }
}

function handleSubmit() {
  if (inputMode === 'ask') {
    const query = input.value.trim()
    if (!query) return
    setMode('loading')
    checkinBridge.ask(query)
    return
  }

  const text = input.value.trim()
  if (!text) return

  if (input.readOnly) {
    checkinBridge.dismiss()
    return
  }

  // fallback: user typed /ask manually without going through the chip flow
  if (text.startsWith('/ask ')) {
    const query = text.slice(5).trim()
    if (!query) return
    setMode('loading')
    checkinBridge.ask(query)
    return
  }

  // /summary or /summary <N>
  if (text === '/summary') {
    setMode('loading')
    checkinBridge.summarize(undefined)
    return
  }
  const summaryMatch = text.match(/^\/summary\s+(\d+)$/)
  if (summaryMatch) {
    setMode('loading')
    checkinBridge.summarize(parseInt(summaryMatch[1], 10))
    return
  }

  checkinBridge.submit(text)
}

input.addEventListener('input', () => {
  if (inputMode === 'ask' || input.readOnly) return

  const val = input.value

  // Show sigil menu when user types / or starts a sigil
  if (val === '/' || (val.startsWith('/') && !val.includes(' '))) {
    sigilMenu.classList.add('visible')
    inputMode = 'sigil'
    return
  }

  // Auto-activate ask mode when /ask<space> is fully typed
  if (val.startsWith('/ask ')) {
    activateAskMode(val.slice(5))
    return
  }

  sigilMenu.classList.remove('visible')
  inputMode = 'normal'
})

sigilMenu.querySelectorAll<HTMLElement>('.sigil-item').forEach(item => {
  item.addEventListener('mousedown', e => {
    e.preventDefault() // keep textarea focused
    if (item.dataset.sigil === 'ask') {
      activateAskMode()
    } else if (item.dataset.sigil === 'summary') {
      sigilMenu.classList.remove('visible')
      input.value = '/summary'
      // Let user optionally append a number, or submit as-is
      input.focus()
    }
  })
})

cmdChipX.addEventListener('click', deactivateAskMode)

checkinBridge.onQuestion((question: string) => {
  questionEl.textContent = question
})

checkinBridge.onAnswer((answer: string) => {
  answerDisplay.innerHTML = renderMarkdown(answer)
  setMode('answered')
})

submitBtn.addEventListener('click', handleSubmit)
dismissBtn.addEventListener('click', () => checkinBridge.dismiss())
settingsBtn.addEventListener('click', () => checkinBridge.openSettings())

input.addEventListener('keydown', (e: KeyboardEvent) => {
  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
    e.preventDefault()
    handleSubmit()
  }
  if (e.key === 'Escape') {
    if (inputMode !== 'normal') deactivateAskMode()
    else checkinBridge.dismiss()
  }
})

input.focus()
