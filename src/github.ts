import { loadSettings } from './settings'

interface GitHubEvent {
  type: string
  created_at: string
  repo: { name: string }
  payload: any
}

let cachedUsername: string | null = null

export function resetGitHubCache() {
  cachedUsername = null
}

async function callGitHubAPI(endpoint: string): Promise<any> {
  const settings = loadSettings()
  const token = settings.githubToken || process.env.GITHUB_TOKEN
  if (!token) throw new Error('No GitHub token configured')

  const response = await fetch(`https://api.github.com${endpoint}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`GitHub API ${response.status}: ${body}`)
  }
  return response.json()
}

export async function getGitHubUsername(): Promise<string> {
  if (cachedUsername) return cachedUsername
  const user = await callGitHubAPI('/user')
  cachedUsername = user.login as string
  return cachedUsername
}

export async function fetchRecentGitHubActivity(hours = 1): Promise<string> {
  const settings = loadSettings()
  const token = settings.githubToken || process.env.GITHUB_TOKEN
  if (!token) return ''

  try {
    const username = await getGitHubUsername()
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000)
    const events: GitHubEvent[] = await callGitHubAPI(
      `/users/${username}/events?per_page=50`
    )

    const recent = events.filter(e => new Date(e.created_at) > cutoff)
    if (recent.length === 0) return ''

    const lines: string[] = []

    for (const event of recent) {
      const repoShort = event.repo.name.includes('/')
        ? event.repo.name.split('/')[1]
        : event.repo.name
      const time = new Date(event.created_at).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      })

      switch (event.type) {
        case 'PushEvent': {
          const commits: any[] = event.payload.commits ?? []
          const msg = commits[0]?.message?.split('\n')[0] ?? ''
          lines.push(
            `[${time}] Pushed ${commits.length} commit(s) to ${repoShort}${msg ? ` — "${msg}"` : ''}`
          )
          break
        }
        case 'PullRequestEvent': {
          const { action, pull_request: pr } = event.payload
          lines.push(`[${time}] ${action} PR #${pr.number} "${pr.title}" in ${repoShort}`)
          break
        }
        case 'PullRequestReviewEvent': {
          const { review, pull_request: pr } = event.payload
          const state = (review?.state ?? 'reviewed').toLowerCase()
          lines.push(`[${time}] ${state} PR #${pr.number} "${pr.title}" in ${repoShort}`)
          break
        }
        case 'PullRequestReviewCommentEvent': {
          const { pull_request: pr } = event.payload
          lines.push(`[${time}] Commented on PR #${pr.number} "${pr.title}" in ${repoShort}`)
          break
        }
        case 'IssueCommentEvent': {
          const { action, issue } = event.payload
          if (action === 'created') {
            lines.push(`[${time}] Commented on issue #${issue.number} "${issue.title}" in ${repoShort}`)
          }
          break
        }
        case 'CreateEvent': {
          const { ref_type, ref } = event.payload
          if (ref_type === 'branch') {
            lines.push(`[${time}] Created branch "${ref}" in ${repoShort}`)
          }
          break
        }
      }
    }

    if (lines.length === 0) return ''
    return `GitHub activity (last ${hours}h):\n${lines.map(l => `  ${l}`).join('\n')}`
  } catch (e) {
    console.error('fetchRecentGitHubActivity failed:', e)
    return ''
  }
}

// Uses the Search API — gives clean PR lists regardless of event history
export async function fetchGitHubPRs(state: 'open' | 'closed' | 'all' = 'all', limit = 15): Promise<string> {
  const settings = loadSettings()
  const token = settings.githubToken || process.env.GITHUB_TOKEN
  if (!token) return ''

  try {
    const username = await getGitHubUsername()
    const stateClause = state !== 'all' ? ` state:${state}` : ''
    // Use encodeURIComponent so spaces become %20 — more reliable than + in fetch
    const q = encodeURIComponent(`author:${username} type:pr${stateClause}`)
    const data = await callGitHubAPI(
      `/search/issues?q=${q}&sort=updated&order=desc&per_page=${limit}`
    )

    if (!data.items?.length) return ''

    const lines: string[] = data.items.map((pr: any) => {
      // repository_url = "https://api.github.com/repos/owner/repo"
      const parts = pr.repository_url.split('/')
      const repo = `${parts[parts.length - 2]}/${parts[parts.length - 1]}`
      const date = new Date(pr.updated_at).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
      })
      const isMerged = !!pr.pull_request?.merged_at
      const status = isMerged ? 'merged' : pr.state
      return `  PR #${pr.number} [${status}] "${pr.title}" in ${repo} — ${date}`
    })

    const header =
      state === 'open'   ? 'Your open PRs' :
      state === 'closed' ? 'Your recently closed/merged PRs' :
                           'Your recent PRs'
    return `${header}:\n${lines.join('\n')}`
  } catch (e) {
    console.error('fetchGitHubPRs failed:', e)
    return ''
  }
}

export async function testGitHubConnection(): Promise<string> {
  const settings = loadSettings()
  const token = settings.githubToken || process.env.GITHUB_TOKEN
  if (!token) return 'No token configured.'

  try {
    const user = await callGitHubAPI('/user')
    cachedUsername = user.login

    // Check scopes via a HEAD request on /user
    const scopeRes = await fetch('https://api.github.com/user', {
      method: 'HEAD',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    })
    const scopes = scopeRes.headers.get('x-oauth-scopes') ?? '(unknown)'

    // Try to search for PRs
    const q = encodeURIComponent(`author:${user.login} type:pr`)
    const search = await callGitHubAPI(`/search/issues?q=${q}&per_page=1`)
    const prCount = search.total_count ?? 0

    return `Connected as @${user.login}\nScopes: ${scopes}\nVisible PRs: ${prCount}\n\n${
      prCount === 0
        ? '⚠️  0 PRs visible — your token likely needs:\n  1. repo scope (not just public_repo)\n  2. SSO authorization for your org at github.com/settings/tokens'
        : '✓ GitHub access looks good.'
    }`
  } catch (e: any) {
    return `Connection failed: ${e.message}`
  }
}

// ── GitHub Device Flow OAuth ──────────────────────────────────────────────────

export interface DeviceFlowStart {
  device_code: string
  user_code: string
  verification_uri: string
  expires_in: number
  interval: number
}

export async function startDeviceFlow(): Promise<DeviceFlowStart> {
  const clientId = process.env.GITHUB_CLIENT_ID
  if (!clientId) throw new Error('GITHUB_CLIENT_ID not set in .env')

  const res = await fetch('https://github.com/login/device/code', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: new URLSearchParams({
      client_id: clientId,
      scope: 'repo read:user',
    }).toString(),
  })

  const data = await res.json() as any
  if (data.error) throw new Error(data.error_description ?? data.error)
  return data as DeviceFlowStart
}

// Returns token string when authorized, null when still pending, throws on expiry/error
export async function pollDeviceFlow(deviceCode: string): Promise<string | null> {
  const clientId = process.env.GITHUB_CLIENT_ID
  if (!clientId) throw new Error('GITHUB_CLIENT_ID not set in .env')

  const res = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: new URLSearchParams({
      client_id: clientId,
      device_code: deviceCode,
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
    }).toString(),
  })

  const data = await res.json() as any

  if (data.access_token) return data.access_token as string
  if (data.error === 'authorization_pending' || data.error === 'slow_down') return null
  throw new Error(data.error_description ?? data.error ?? 'Authorization failed')
}

// Combined GitHub context for /ask and /summary
export async function fetchGitHubContext(activityHours = 48): Promise<string> {
  const settings = loadSettings()
  const token = settings.githubToken || process.env.GITHUB_TOKEN
  if (!token) return ''

  const [openPRs, closedPRs, recentActivity] = await Promise.allSettled([
    fetchGitHubPRs('open', 10),
    fetchGitHubPRs('closed', 10),
    fetchRecentGitHubActivity(activityHours),
  ])

  const parts = [openPRs, closedPRs, recentActivity]
    .map(r => r.status === 'fulfilled' ? r.value : '')
    .filter(Boolean)

  return parts.join('\n\n')
}
