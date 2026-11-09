import { RefreshCw, Ticket } from 'lucide-react'
import { PaginationDemo } from './PaginationDemo.tsx'
import type { Walkthrough } from './useWalkthrough.ts'
export function TaskAnalysisDemo({ walkthrough: w, onTeamActivity }: { walkthrough: Walkthrough; onTeamActivity: () => void }) {
  return <>
    <section className="demo-selector-card database-task-panel" aria-label="Supabase assignments">
      <div className="database-task-heading">
        <div><span className="selector-eyebrow"><Ticket size={15} /> SUPABASE ASSIGNMENTS</span><h2 className="selector-title">My tasks</h2></div>
        <button type="button" className="cyan-btn-secondary" disabled={w.tasksLoading} onClick={() => { void w.loadTasks() }}><RefreshCw size={15} /> Refresh tasks</button>
      </div>
      {w.tasksLoading ? <p role="status">Loading assigned tasks…</p> : w.tasksError ? <p role="alert">{w.tasksError}</p> : w.tasks.length === 0 ? <p>No assignments yet. Create an Auth user, then preview <code>npm run demo:setup-task</code> using the local setup guide.</p> :
        <div className="task-card-grid" role="group" aria-label="Supabase tasks">{w.tasks.map((task) => <button key={task.id} type="button" className={`task-choice-card ${w.selectedId === task.id ? 'task-choice-card--selected' : ''}`} aria-pressed={w.selectedId === task.id} onClick={() => w.chooseTask(task.id)}>
          <span className="task-choice-top"><span>{task.status.replace('_', ' ')}</span><span>{w.selectedId === task.id ? 'Selected' : 'Select'}</span></span><strong>{task.title}</strong><span>{task.component}</span>
        </button>)}</div>}
      {w.selectedTask && <details className="database-task-detail"><summary>Task dependency mapping</summary><p>Component: {w.selectedTask.component}</p><p>Task ID: {w.selectedTask.id}</p>{w.selectedTask.dependencies.length ? w.selectedTask.dependencies.map((d) => <p key={d.endpoint}><code>{d.endpoint}</code> · Uses {d.usedFields.join(', ') || 'no recorded fields'}</p>) : <p>Dependency not verified. Impact will remain uncertain.</p>}</details>}
    </section>
    <PaginationDemo walkthrough={w} onTeamActivity={onTeamActivity} />
  </>
}
