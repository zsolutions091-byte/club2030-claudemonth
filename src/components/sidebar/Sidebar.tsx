import Link from 'next/link'
import { CalendarDays, Inbox, ListTodo, Sun, FolderOpen } from 'lucide-react'
import { ProjectCreateDialog } from '@/components/projects/ProjectCreateDialog'

type SidebarProject = {
  id: string
  name: string
  color: string
  icon: string | null
}

const NAV = [
  { href: '/today', label: 'היום', icon: Sun },
  { href: '/week', label: 'השבוע', icon: CalendarDays },
  { href: '/inbox', label: 'תיבת נכנסים', icon: Inbox },
  { href: '/all', label: 'הכל', icon: ListTodo },
]

export function Sidebar({ projects }: { projects: SidebarProject[] }) {
  return (
    <aside className="border-l border-border bg-sidebar text-sidebar-foreground flex flex-col h-screen sticky top-0">
      <div className="px-5 py-4 border-b border-sidebar-border">
        <Link href="/all" className="font-bold text-lg text-primary">
          משימות
        </Link>
      </div>

      <nav className="px-3 py-3 space-y-1">
        {NAV.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-sidebar-accent transition-colors text-sm"
          >
            <Icon className="size-4" />
            <span>{label}</span>
          </Link>
        ))}
      </nav>

      <div className="px-3 py-3 border-t border-sidebar-border flex-1 overflow-y-auto">
        <div className="flex items-center justify-between px-3 mb-2">
          <span className="text-xs uppercase tracking-wider text-muted-foreground">
            פרויקטים
          </span>
          <ProjectCreateDialog />
        </div>
        {projects.length === 0 ? (
          <p className="px-3 text-xs text-muted-foreground py-2">אין פרויקטים עדיין</p>
        ) : (
          <ul className="space-y-1">
            {projects.map((project) => (
              <li key={project.id}>
                <Link
                  href={`/project/${project.id}`}
                  className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-sidebar-accent text-sm"
                >
                  <span
                    className="size-3 rounded-full inline-block"
                    style={{ backgroundColor: project.color }}
                    aria-hidden
                  />
                  {project.icon ? (
                    <span aria-hidden>{project.icon}</span>
                  ) : (
                    <FolderOpen className="size-4 text-muted-foreground" />
                  )}
                  <span className="truncate">{project.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="px-3 py-3 border-t border-sidebar-border">
        <span className="px-3 text-xs uppercase tracking-wider text-muted-foreground">
          תגיות
        </span>
        <p className="px-3 text-xs text-muted-foreground py-2">בקרוב</p>
      </div>
    </aside>
  )
}
