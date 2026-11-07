import type { ActivityResponse, ActivitySource, CatchUpResult } from './catchup.ts'
import type { TimeWindow } from './time.ts'

export interface BackendHealth {
  status: 'ok'
  sources: Record<ActivitySource, 'configured' | 'unconfigured'>
}

export async function getBackendHealth(): Promise<BackendHealth> {
  const response = await fetch('/api/health')
  if (!response.ok) throw new Error('The local API is unavailable.')
  return response.json() as Promise<BackendHealth>
}

export async function createLiveCatchUp(window: TimeWindow): Promise<CatchUpResult> {
  const query = new URLSearchParams({ start: window.start.toISOString(), end: window.end.toISOString() })
  const response = await fetch(`/api/activity?${query}`)
  if (!response.ok) throw new Error('Live activity could not be loaded from the local API.')
  const data = await response.json() as ActivityResponse
  return {
    window,
    activities: data.activities,
    insights: [],
    generatedAt: new Date(),
    mode: 'live',
    sources: data.sources,
  }
}
