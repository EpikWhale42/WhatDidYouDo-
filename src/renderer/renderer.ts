const checkinBridge = (window as any).api as {
  submit: (text: string) => void
  dismiss: () => void
  onQuestion: (callback: (question: string) => void) => void
  openSettings: () => void
}

const questionEl = document.getElementById('question') as HTMLElement
const input = document.getElementById('input') as HTMLTextAreaElement
const submitBtn = document.getElementById('submit') as HTMLButtonElement
const dismissBtn = document.getElementById('dismiss') as HTMLButtonElement
const settingsBtn = document.getElementById('settings') as HTMLButtonElement

checkinBridge.onQuestion((question: string) => {
  questionEl.textContent = question
})

submitBtn.addEventListener('click', () => {
  checkinBridge.submit(input.value)
})

dismissBtn.addEventListener('click', () => {
  checkinBridge.dismiss()
})

input.addEventListener('keydown', (e: KeyboardEvent) => {
  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
    checkinBridge.submit(input.value)
  }
  if (e.key === 'Escape') {
    checkinBridge.dismiss()
  }
})

settingsBtn.addEventListener('click', () => {
  checkinBridge.openSettings()
})

input.focus()
