import { Sidebar } from '@/components/sidebar/Sidebar'
import { prisma } from '@/lib/db'

export async function AppShell({ children }: { children: React.ReactNode }) {
  const projects = await prisma.project.findMany({
    where: { deletedAt: null, isArchived: false, parentId: null },
    orderBy: [{ position: 'asc' }, { name: 'asc' }],
    select: { id: true, name: true, color: true, icon: true },
  })

  return (
    <div className="grid min-h-screen grid-cols-[260px_1fr] grid-rows-1">
      <Sidebar projects={projects} />
      <main className="overflow-y-auto">{children}</main>
    </div>
  )
}
