import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { loadSettings } from './settings'

const LOG_DIR = path.join(os.homedir(), 'Documents', 'WhatDidYouDo-Logs')

function readRecentLogs(days = 30): string {
  const entries: string[] = []
  for (let i = 0; i < days; i++) {
    const date = new Date()
    date.setDate(date.getDate() - i)
    const dateStr = date.toISOString().split('T')[0]
    const userLog = path.join(LOG_DIR, `${dateStr}.md`)
    const agentLog = path.join(LOG_DIR, `agent-${dateStr}.md`)
    if (fs.existsSync(userLog))  entries.push(fs.readFileSync(userLog, 'utf8'))
    if (fs.existsSync(agentLog)) entries.push(fs.readFileSync(agentLog, 'utf8'))
  }
  return entries.join('\n\n---\n\n')
}

export async function summarizeLogs(hours?: number): Promise<string> {
  const logs = readRecentLogs(hours ? Math.ceil(hours / 24) + 1 : 1)
  if (!logs.trim()) return "No logs found yet. Answer a few check-ins first."

  const now = new Date()
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  const scope = hours
    ? `the last ${hours} hour${hours === 1 ? '' : 's'} (current time: ${timeStr})`
    : `today so far (current time: ${timeStr})`

  const system = `You are a personal productivity assistant. Summarize the user's work for ${scope} based on their logs.

Format as a concise standup-style bullet list:
• What was completed
• What's still in progress
• Any blockers or next steps (only if mentioned)

Use the actual task names from the logs. 3–6 bullets max. No preamble or sign-off.`

  try {
    const summary = await callOpenRouter([
      { role: 'system', content: system },
      { role: 'user', content: `Logs:\n${logs}` },
    ], 350)
    return summary.trim()
  } catch (e) {
    console.error('summarizeLogs failed:', e)
    return 'Something went wrong while summarizing. Check your API key in Settings.'
  }
}

export async function answerQuery(question: string): Promise<string> {
  const logs = readRecentLogs(30)
  if (!logs.trim()) return "I don't have any logs to search yet. Answer a few check-ins first."

  const system = `You are a personal memory assistant. You have access to the user's work logs from the past 30 days — both their own words and structured agent notes.

Answer the user's question based only on what's in the logs. Be specific: mention dates and times when relevant. If the logs don't contain enough information to answer, say so honestly.

Keep your answer concise and direct. No preamble.`

  try {
    const answer = await callOpenRouter([
      { role: 'system', content: system },
      { role: 'user', content: `Logs:\n${logs}\n\nQuestion: ${question}` },
    ], 400)
    return answer.trim()
  } catch (e) {
    console.error('answerQuery failed:', e)
    return 'Something went wrong while searching your logs. Check your API key in Settings.'
  }
}

export function getAgentLogPath(): string {
  const today = new Date().toISOString().split('T')[0]
  return path.join(LOG_DIR, `agent-${today}.md`)
}

function readFileSafe(filePath: string): string {
  try {
    return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : ''
  } catch {
    return ''
  }
}

async function callOpenRouter(
  messages: Array<{ role: string; content: string }>,
  maxTokens = 250
): Promise<string> {
  const settings = loadSettings()
  const apiKey = settings.apiKey || process.env.OPENROUTER_API_KEY
  const model = settings.model || process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini'

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://whatdidyoudo.app',
      'X-Title': 'What Did You Do',
    },
    body: JSON.stringify({ model, messages, max_tokens: maxTokens }),
  })

  const data = (await response.json()) as any
  if (!data.choices?.[0]) {
    throw new Error(`OpenRouter API error: ${JSON.stringify(data)}`)
  }
  return data.choices[0].message.content as string
}

export async function generateQuestion(userLogPath: string): Promise<string> {
  const { apiKey } = loadSettings()
  if (!apiKey && !process.env.OPENROUTER_API_KEY) {
    return 'What did you do in the last hour?'
  }

  const userLog = readFileSafe(userLogPath)
  const agentLog = readFileSafe(getAgentLogPath())

  const system = `You are a friendly productivity assistant that checks in with someone every hour.
You have their daily log and your own tracking notes. Generate a short, natural check-in question.

Rules:
- If there are recent in-progress tasks, ask how those went or if they're done
- Otherwise ask what they've been working on
- 1-2 sentences max, conversational, like a colleague asking
- Do NOT start with "Hey" or hollow phrases like "Great job"
- Output ONLY the question, nothing else`

  const context = `Today's user log:\n${userLog || '(no entries yet)'}\n\nAgent tracking notes:\n${agentLog || '(none yet)'}`

  try {
    const question = await callOpenRouter(
      [
        { role: 'system', content: system },
        { role: 'user', content: context },
      ],
      100
    )
    return question.trim()
  } catch (e) {
    console.error('AI question generation failed:', e)
    return 'What did you do in the last hour?'
  }
}

export async function processResponse(
  question: string,
  answer: string
): Promise<{ snoozeMinutes: number }> {
  const agentLogPath = getAgentLogPath()
  const now = new Date()
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  const dateHeader = now.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  let agentNote: string

  const { apiKey } = loadSettings()
  if (!apiKey && !process.env.OPENROUTER_API_KEY) {
    agentNote = `**Q**: ${question}\n**A**: ${answer}`
  } else {
    const system = `You track a user's hourly work check-ins. Given the question asked and their response, write a brief structured note for your agent log.

Use exactly this format:
**Tasks**: <comma-separated tasks mentioned>
**Status**: <In Progress | Completed | Blocked | Mixed>
**Note**: <one sentence observation>
**Follow-up**: <specific question to ask next time based on what's still in progress>
**Snooze**: <if the user asked not to be interrupted for a specific time, write the number of minutes. Otherwise write 0>

Snooze examples:
- "don't interrupt for 1 hour" → **Snooze**: 60
- "leave me alone for 30 mins" → **Snooze**: 30
- "deep work for 2 hours" → **Snooze**: 120
- "working on X" (no DND request) → **Snooze**: 0

Be specific. Output only the formatted note.`

    try {
      agentNote = await callOpenRouter(
        [
          { role: 'system', content: system },
          { role: 'user', content: `Question: "${question}"\nResponse: "${answer}"` },
        ],
        200
      )
    } catch (e) {
      console.error('AI response processing failed:', e)
      agentNote = `**Tasks**: (unprocessed)\n**Status**: Unknown\n**Note**: AI processing failed\n**Follow-up**: What did you work on?`
    }
  }

  const isNew = !fs.existsSync(agentLogPath)
  const header = isNew ? `# Agent Log — ${dateHeader}\n\n` : ''
  const entry = `## ${timeStr}\n\n${agentNote}\n\n---\n\n`
  fs.appendFileSync(agentLogPath, header + entry, 'utf8')

  const snoozeMatch = agentNote.match(/\*\*Snooze\*\*:\s*(\d+)/)
  const snoozeMinutes = snoozeMatch ? parseInt(snoozeMatch[1], 10) : 0
  return { snoozeMinutes }
}
