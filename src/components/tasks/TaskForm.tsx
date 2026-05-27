'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { createTask, updateTask } from '@/lib/actions/tasks'
import {
  STATUS_LABELS,
  PRIORITY_LABELS,
  type TaskStatusValue,
  type TaskPriorityValue,
} from '@/lib/validators/task'

type ProjectOption = { id: string; name: string }

type TaskFormValues = {
  id?: string
  title: string
  description?: string | null
  status: TaskStatusValue
  priority: TaskPriorityValue
  dueDate?: string | null
  dueHasTime: boolean
  dueTime?: string
  startDate?: string | null
  estimatedMinutes?: number | null
  projectId?: string | null
}

type Props = {
  projects: ProjectOption[]
  initial?: Partial<TaskFormValues>
  onSuccess?: () => void
  submitLabel?: string
}

const NO_PROJECT = '__none__'

function toDateInputValue(value: string | null | undefined): string {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function toTimeInputValue(value: string | null | undefined, hasTime: boolean): string {
  if (!value || !hasTime) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

export function TaskForm({ projects, initial, onSuccess, submitLabel = 'שמור' }: Props) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [status, setStatus] = useState<TaskStatusValue>(initial?.status ?? 'OPEN')
  const [priority, setPriority] = useState<TaskPriorityValue>(initial?.priority ?? 'P4')
  const [dueDate, setDueDate] = useState(toDateInputValue(initial?.dueDate))
  const [dueHasTime, setDueHasTime] = useState(initial?.dueHasTime ?? false)
  const [dueTime, setDueTime] = useState(
    toTimeInputValue(initial?.dueDate, initial?.dueHasTime ?? false),
  )
  const [startDate, setStartDate] = useState(toDateInputValue(initial?.startDate))
  const [projectId, setProjectId] = useState<string>(initial?.projectId ?? NO_PROJECT)
  const [pending, startTransition] = useTransition()

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    let dueIso: string | undefined
    if (dueDate) {
      const d = new Date(dueDate)
      if (dueHasTime && dueTime) {
        const [hh, mm] = dueTime.split(':').map((s) => Number(s))
        d.setHours(Number.isFinite(hh) ? hh : 23, Number.isFinite(mm) ? mm : 59, 0, 0)
      } else {
        d.setHours(23, 59, 0, 0)
      }
      dueIso = d.toISOString()
    }

    const startIso = startDate ? new Date(startDate).toISOString() : undefined

    const payload = {
      title: title.trim(),
      description: description.trim() || undefined,
      status,
      priority,
      dueDate: dueIso,
      dueHasTime: !!(dueIso && dueHasTime && dueTime),
      startDate: startIso,
      projectId: projectId === NO_PROJECT ? undefined : projectId,
    }

    startTransition(async () => {
      try {
        if (initial?.id) {
          await updateTask(initial.id, payload)
          toast.success('המשימה עודכנה')
        } else {
          await createTask(payload)
          toast.success('משימה נוצרה')
        }
        onSuccess?.()
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'שגיאה'
        toast.error(msg)
      }
    })
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="task-title">כותרת</Label>
        <Input
          id="task-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="מה צריך לעשות?"
          required
          maxLength={500}
          autoFocus
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="task-description">תיאור</Label>
        <Textarea
          id="task-description"
          value={description ?? ''}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="פרטים נוספים (אופציונלי, תומך Markdown)"
          rows={3}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>סטטוס</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as TaskStatusValue)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>עדיפות</Label>
          <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriorityValue)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>תאריך יעד</Label>
        <div className="flex flex-wrap gap-2 items-center">
          <Input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="w-40"
          />
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox
              checked={dueHasTime}
              onCheckedChange={(v) => setDueHasTime(v === true)}
              disabled={!dueDate}
            />
            <span>כולל שעה</span>
          </label>
          {dueHasTime && dueDate && (
            <Input
              type="time"
              value={dueTime}
              onChange={(e) => setDueTime(e.target.value)}
              className="w-28"
            />
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="task-start">תאריך התחלה (לא תופיע ב&quot;היום&quot; לפני זה)</Label>
        <Input
          id="task-start"
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="w-40"
        />
      </div>

      <div className="space-y-2">
        <Label>פרויקט</Label>
        <Select value={projectId} onValueChange={(v) => setProjectId(v ?? NO_PROJECT)}>
          <SelectTrigger>
            <SelectValue placeholder="בחר פרויקט" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_PROJECT}>ללא פרויקט</SelectItem>
            {projects.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex justify-start gap-2 pt-2">
        <Button type="submit" disabled={pending || !title.trim()}>
          {pending ? 'שומר…' : submitLabel}
        </Button>
      </div>
    </form>
  )
}
