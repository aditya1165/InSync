export interface AssignedTask {
  id: string
  title: string
  component: string
  status: 'todo' | 'in_progress' | 'done'
  dependencies: { endpoint: string; usedFields: string[] }[]
}

export async function fetchAssignedTasks(): Promise<AssignedTask[]> {
  const response = await fetch('/api/tasks')
  const data = await response.json() as { tasks?: AssignedTask[]; error?: string }
  if (!response.ok) throw new Error(data.error || 'Tasks could not be loaded.')
  return data.tasks ?? []
}
