import { useEffect, useReducer, useRef, useState } from 'react'
import { fetchAssignedTasks, type AssignedTask } from './lib/tasks.ts'
import type { LinkReview, PaginationCatchUp, ReplaySettings, SlackEventStatus } from './lib/real-demo.ts'
import { emptyWalkthrough, walkthroughReducer } from './lib/walkthrough.ts'
export function localDate(date: Date) { return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16) }
export type Walkthrough = ReturnType<typeof useWalkthrough>
export function useWalkthrough() {
  const [tasks, setTasks] = useState<AssignedTask[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [tasksLoading, setTasksLoading] = useState(true)
  const [tasksError, setTasksError] = useState('')
  const [mode, setMode] = useState<'replay' | 'human' | 'seeded' | 'sample'>('replay')
  const [start, setStart] = useState(() => localDate(new Date(Date.now() - 7 * 86400000)))
  const [end, setEnd] = useState(() => localDate(new Date()))
  const [throughNow, setThroughNow] = useState(false)
  const [replay, setReplay] = useState<ReplaySettings | null>(null)
  const [replayError, setReplayError] = useState('')
  const [useSavedWindow, setUseSavedWindow] = useState(true)
  const [events, setEvents] = useState<SlackEventStatus | null>(null)
  const [threadTs, setThreadTs] = useState('')
  const [state, dispatch] = useReducer(walkthroughReducer, emptyWalkthrough)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [correctedId, setCorrectedId] = useState('')
  const requestId = useRef(0)
  const taskRequest = useRef(0)
  const selectedTask = tasks.find((t) => t.id === selectedId)
  function reset() { ++requestId.current; dispatch({ type: 'reset' }); setLoading(false); setError(''); setCorrectedId('') }
  function chooseTask(id: string) { reset(); setSelectedId(id) }
  function chooseMode(value: typeof mode) { reset(); setMode(value) }
  async function loadTasks() {
    const id = ++taskRequest.current
    setTasksLoading(true); setTasksError('')
    try {
      const next = await fetchAssignedTasks()
      if (id !== taskRequest.current) return
      setTasks(next)
      setSelectedId((current) => next.some((t) => t.id === current) ? current : next.find((t) => t.component === 'ProductList')?.id || next[0]?.id || '')
      reset()
    } catch (e) {
      if (id !== taskRequest.current) return
      setTasks([]); setSelectedId(''); reset(); setTasksError(e instanceof Error ? e.message : 'Assignments unavailable.')
    } finally { if (id === taskRequest.current) setTasksLoading(false) }
  }
  useEffect(() => { void loadTasks(); return () => { ++taskRequest.current; ++requestId.current } }, [])
  useEffect(() => {
    let active = true
    setReplay(null); setReplayError('')
    if (!selectedId) return
    void (async () => {
      try {
        const response = await fetch(`/api/real-demo/replay?${new URLSearchParams({ taskId: selectedId })}`)
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Saved scenario unavailable.')
        if (active) setReplay(data)
      } catch (e) { if (active) setReplayError(e instanceof Error ? e.message : 'Saved scenario unavailable.') }
    })()
    return () => { active = false }
  }, [selectedId])
  useEffect(() => {
    if (mode !== 'human' && mode !== 'replay') return
    let active = true; let fetching = false
    async function refresh() {
      if (fetching) return
      fetching = true
      try {
        const response = await fetch('/api/slack-events/status')
        if (!response.ok) return
        const data: SlackEventStatus = await response.json()
        if (active) { setEvents(data); setThreadTs((current) => current || data.threads[0]?.threadTs || '') }
      } catch { /* Evidence remains a snapshot; fresh readback is required on Catch me up. */ }
      finally { fetching = false }
    }
    void refresh()
    const timer = window.setInterval(() => { void refresh() }, 5000)
    return () => { active = false; window.clearInterval(timer) }
  }, [mode])
  const observed = events?.threads.find((t) => t.threadTs === state.result?.slackThreadTs)
  const stale = !!state.result?.slackThreadTs && !!observed && observed.revision !== state.result.slackThreadRevision
  useEffect(() => { if (stale) dispatch({ type: 'review', review: { state: 'pending' } }) }, [stale])
  async function catchUp() {
    const id = ++requestId.current
    dispatch({ type: 'reset' }); setLoading(true); setError('')
    try {
      const saved = mode === 'replay' && useSavedWindow
      const from = saved ? replay?.window.start : new Date(start).toISOString()
      const to = saved ? replay?.window.end : throughNow ? new Date().toISOString() : new Date(end).toISOString()
      if (!from || !to || Date.parse(from) >= Date.parse(to)) throw new Error('Choose a valid window or load the saved scenario.')
      if (mode !== 'sample' && !selectedTask) throw new Error('Select a Supabase assignment first.')
      if (mode === 'human' && !threadTs) throw new Error('Choose a collected human discussion.')
      const params = new URLSearchParams({ mode: mode === 'sample' ? 'sample' : 'live', start: from, end: to })
      if (selectedTask && mode !== 'sample') params.set('taskId', selectedTask.id)
      if (mode === 'replay') params.set('replay', 'true')
      if (mode === 'human') params.set('threadTs', threadTs)
      const response = await fetch(`/api/real-demo/catch-up?${params}`)
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Evidence unavailable.')
      if (id !== requestId.current) return
      dispatch({ type: 'loaded', result: { ...data, retrievedAt: new Date().toISOString() } as PaginationCatchUp }); setCorrectedId(data.messages[0]?.id || '')
    } catch (e) { if (id === requestId.current) setError(e instanceof Error ? e.message : 'Catch-up unavailable.') }
    finally { if (id === requestId.current) setLoading(false) }
  }
  function applyReview(review: LinkReview) { if (!stale) dispatch({ type: 'review', review }) }
  return { ...state, tasks, selectedId, selectedTask, tasksLoading, tasksError, loadTasks, chooseTask, mode, chooseMode,
    start, end, setStart, setEnd, throughNow, setThroughNow, replay, replayError, useSavedWindow, setUseSavedWindow,
    events, threadTs, setThreadTs, loading, error, catchUp, reset, correctedId, setCorrectedId, stale, applyReview,
    toggleWhy: () => dispatch({ type: 'why' }) }
}
