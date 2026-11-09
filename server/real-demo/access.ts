import type { FastifyRequest } from 'fastify'
import type { AssignedTask } from '../db/tasks.ts'
import type { SourceScope } from '../db/catchup.ts'
import type { DemoConfig } from './config.ts'
export interface TaskAccess {
  resolveTaskIdentity?: (request: FastifyRequest) => Promise<{ userId: string; workspaceId: string } | null>
  taskStore?: {
    listAssignedTasks(userId: string, workspaceId: string): Promise<AssignedTask[]>
    listUserSources?(userId: string, workspaceId: string): Promise<SourceScope[]>
  }
}
export class AccessError extends Error {
  status: number
  constructor(status: number, message: string) { super(message); this.status = status }
}
export async function authorizeTask(access: TaskAccess, request: FastifyRequest, taskId: string | undefined, c: DemoConfig) {
  const identity = await access.resolveTaskIdentity?.(request)
  if (!identity) throw new AccessError(401, 'Sign-in is required to catch up on an assigned task.')
  if (!access.taskStore?.listUserSources) throw new AccessError(503, 'The task database and source grants are not configured.')
  if (!taskId || !/^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i.test(taskId)) throw new AccessError(400, 'Choose an assigned taskId.')
  const tasks = await access.taskStore.listAssignedTasks(identity.userId, identity.workspaceId)
  const task = tasks.find((t) => t.id === taskId)
  if (!task) throw new AccessError(404, 'Assigned task unavailable in this workspace.')
  const sources = await access.taskStore.listUserSources(identity.userId, identity.workspaceId)
  if (!sources.some((s) => s.provider === 'github' && s.externalId === c.repository)
    || !sources.some((s) => s.provider === 'slack' && s.externalId === c.channel)) {
    throw new AccessError(403, 'This task workspace needs approved access to both scenario sources.')
  }
  return task
}
