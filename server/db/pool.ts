import { Pool } from 'pg'

export function createDatabasePool(connectionString: string): Pool {
  if (!/^postgres(?:ql)?:\/\//.test(connectionString)) {
    throw new Error('DATABASE_URL must be a PostgreSQL connection string.')
  }

  const url = new URL(connectionString)
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  if (!local && !['require', 'verify-ca', 'verify-full'].includes(url.searchParams.get('sslmode') ?? '')) {
    throw new Error('Remote DATABASE_URL must use sslmode=require or stronger.')
  }

  return new Pool({ connectionString, max: 5, connectionTimeoutMillis: 5000 })
}
