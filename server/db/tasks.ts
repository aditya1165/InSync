import type { Pool } from 'pg'

export interface AssignedTask {
  id: string
  title: string
  component: string
  status: 'todo' | 'in_progress' | 'done'
  dependencies: { endpoint: string; usedFields: string[] }[]
}

/** The membership join limits this privileged server query to one assigned user. */
export async function listAssignedTasks(
  db: Pick<Pool, 'query'>,
  userId: string,
  workspaceId: string,
): Promise<AssignedTask[]> {
  const result = await db.query<{
    id: string
    title: string
    component: string
    status: AssignedTask['status']
    endpoint: string | null
    used_fields: string[] | null
  }>(
    `select t.id, t.title, t.component, t.status, d.endpoint, d.used_fields
       from public.workspace_memberships m
       join public.tasks t
         on t.workspace_id = m.workspace_id and t.user_id = m.user_id
       left join public.task_api_dependencies d on d.task_id = t.id
      where m.workspace_id = $1 and m.user_id = $2
      order by t.created_at, t.id, d.endpoint`,
    [workspaceId, userId],
  )

  const tasks = new Map<string, AssignedTask>()
  for (const row of result.rows) {
    let task = tasks.get(row.id)
    if (!task) {
      task = {
        id: row.id,
        title: row.title,
        component: row.component,
        status: row.status,
        dependencies: [],
      }
      tasks.set(row.id, task)
    }
    if (row.endpoint) {
      task.dependencies.push({ endpoint: row.endpoint, usedFields: row.used_fields ?? [] })
    }
  }
  return [...tasks.values()]
}
