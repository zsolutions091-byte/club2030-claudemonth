'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { TaskForm } from '@/components/tasks/TaskForm'
import type { TaskStatusValue, TaskPriorityValue } from '@/lib/validators/task'

type ProjectOption = { id: string; name: string }

type TaskInitial = {
  id: string
  title: string
  description: string | null
  status: TaskStatusValue
  priority: TaskPriorityValue
  dueDate: string | null
  dueHasTime: boolean
  startDate: string | null
  projectId: string | null
}

export function TaskEditDialog({
  task,
  projects,
  open,
  onOpenChange,
}: {
  task: TaskInitial | null
  projects: ProjectOption[]
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  if (!task) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>עריכת משימה</DialogTitle>
        </DialogHeader>
        <TaskForm
          projects={projects}
          initial={task}
          onSuccess={() => onOpenChange(false)}
          submitLabel="עדכן"
        />
      </DialogContent>
    </Dialog>
  )
}

export function useTaskEditDialog() {
  const [editing, setEditing] = useState<TaskInitial | null>(null)
  return {
    editing,
    open: editing !== null,
    openFor: (task: TaskInitial) => setEditing(task),
    close: () => setEditing(null),
  }
}
