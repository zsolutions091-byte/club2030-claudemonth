import 'server-only'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import { PrismaClient } from '@/generated/prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function makeClient() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not set')
  // SQLite file paths in DATABASE_URL are written as `file:./dev.db` (relative to prisma/).
  // The adapter expects an absolute or process-relative path; convert.
  const filename = url.startsWith('file:') ? url.slice(5) : url
  const adapter = new PrismaBetterSqlite3({ url: `file:${filename}` })
  return new PrismaClient({ adapter })
}

export const prisma = globalForPrisma.prisma ?? makeClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
