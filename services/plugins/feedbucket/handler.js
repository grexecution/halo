/**
 * Feedbucket plugin handler
 *
 * Real API calls to Feedbucket REST API.
 * https://feedbucket.com/api
 *
 * Requires FEEDBUCKET_API_KEY environment variable or keychain entry.
 */

const BASE_URL = 'https://app.feedbucket.com/api/v1'

function getApiKey() {
  const key = process.env['FEEDBUCKET_API_KEY']
  if (!key) throw new Error('FEEDBUCKET_API_KEY not set — configure it in Connectors')
  return key
}

async function apiCall(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Feedbucket API error ${res.status}: ${text}`)
  }
  return res.json()
}

export async function list_projects() {
  const data = await apiCall('/projects')
  return (data.projects ?? data).map((p) => ({
    id: p.id,
    name: p.name,
    url: p.url,
    feedbackCount: p.feedback_count ?? 0,
  }))
}

export async function get_feedback({ projectId, status = 'open', limit = 20 }) {
  const params = new URLSearchParams({ status, per_page: String(limit) })
  const data = await apiCall(`/projects/${projectId}/feedback?${params}`)
  return (data.items ?? data).map((item) => ({
    id: item.id,
    title: item.title,
    description: item.description,
    type: item.type,
    status: item.status,
    createdAt: item.created_at,
    screenshot: item.screenshot_url ?? null,
    comments: (item.comments ?? []).map((c) => ({ author: c.author, text: c.body })),
  }))
}

export async function create_item({ projectId, title, description = '', type = 'improvement' }) {
  const data = await apiCall(`/projects/${projectId}/feedback`, {
    method: 'POST',
    body: JSON.stringify({ title, description, type }),
  })
  return { id: data.id, url: data.url, created: true }
}
