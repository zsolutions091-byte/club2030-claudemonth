'use client'

import { useTransition } from 'react'
import { Calendar, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  PRIORITY_COLORS,
  type TaskStatusValue,
  type TaskPriorityValue,
} from '@/lib/validators/task'
import { completeTask, reopenTask, softDeleteTask } from '@/lib/actions/tasks'

type TaskRowData = {
  id: string
  title: string
  status: TaskStatusValue
  priority: TaskPriorityValue
  dueDate: string | null
  dueHasTime: boolean
  project: { id: string; name: string; color: string } | null
}

const HEBREW_DATE_FORMAT = new Intl.DateTimeFormat('he-IL', {
  day: 'numeric',
  month: 'short',
})
const HEBREW_TIME_FORMAT = new Intl.DateTimeFormat('he-IL', {
  hour: '2-digit',
  minute: '2-digit',
})

function formatDue(iso: string | null, hasTime: boolean): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const datePart = HEBREW_DATE_FORMAT.format(d)
  if (!hasTime) return datePart
  return `${datePart}, ${HEBREW_TIME_FORMAT.format(d)}`
}

function isOverdue(iso: string | null, status: TaskStatusValue): boolean {
  if (!iso) return false
  if (status === 'DONE' || status === 'CANCELLED') return false
  return new Date(iso).getTime() < Date.now()
}

export function TaskRow({
  task,
  onEdit,
}: {
  task: TaskRowData
  onEdit: () => void
}) {
  const [pending, startTransition] = useTransition()
  const isDone = task.status === 'DONE' || task.status === 'CANCELLED'
  const dueLabel = formatDue(task.dueDate, task.dueHasTime)
  const overdue = isOverdue(task.dueDate, task.status)

  const onToggleComplete = (checked: boolean) => {
    startTransition(async () => {
      try {
        if (checked) {
          await completeTask(task.id)
          toast.success('המשימה הושלמה')
        } else {
          await reopenTask(task.id)
          toast.success('המשימה נפתחה מחדש')
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'שגיאה'
        toast.error(msg)
      }
    })
  }

  const onDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    startTransition(async () => {
      try {
        await softDeleteTask(task.id)
        toast.success('המשימה נמחקה')
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'שגיאה'
        toast.error(msg)
      }
    })
  }

  return (
    <div
      className={`group flex items-center gap-3 px-3 py-2.5 rounded-md border border-border bg-card hover:border-primary/30 transition-colors cursor-pointer ${
        isDone ? 'opacity-60' : ''
      } ${pending ? 'pointer-events-none opacity-50' : ''}`}
      onClick={onEdit}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onEdit()
        }
      }}
    >
      <div onClick={(e) => e.stopPropagation()} className="shrink-0">
        <Checkbox
          checked={isDone}
          onCheckedChange={(v) => onToggleComplete(v === true)}
          aria-label={isDone ? 'בטל השלמה' : 'סמן כהושלם'}
        />
      </div>

      <span
        aria-hidden
        className="size-2 rounded-full shrink-0"
        style={{ backgroundColor: PRIORITY_COLORS[task.priority] }}
        title={task.priority}
      />

      <div className="flex-1 min-w-0">
        <div className={`text-sm truncate ${isDone ? 'line-through' : ''}`}>{task.title}</div>
        <div className="flex items-center gap-2 mt-0.5">
          {task.project && (
            <Badge
              variant="outline"
              className="text-xs gap-1.5"
              style={{ borderColor: task.project.color }}
            >
              <span
                aria-hidden
                className="size-2 rounded-full"
                style={{ backgroundColor: task.project.color }}
              />
              {task.project.name}
            </Badge>
          )}
          {dueLabel && (
            <span
              className={`text-xs flex items-center gap-1 ${
                overdue ? 'text-destructive' : 'text-muted-foreground'
              }`}
            >
              <Calendar className="size-3" />
              {dueLabel}
              {overdue && <span className="ms-1 font-medium">באיחור</span>}
            </span>
          )}
        </div>
      </div>

      <Button
        variant="ghost"
        size="icon"
        className="size-7 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={onDelete}
        aria-label="מחק"
      >
        <Trash2 className="size-3.5" />
      </Button>
    </div>
  )
}

export type { TaskRowData }
