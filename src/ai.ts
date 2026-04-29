import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { loadSettings } from './settings'

const LOG_DIR = path.join(os.homedir(), 'Documents', 'WhatDidYouDo-Logs')

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
