'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { TaskForm } from '@/components/tasks/TaskForm'

type ProjectOption = { id: string; name: string }

export function TaskCreateDialog({ projects }: { projects: ProjectOption[] }) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button>
            <Plus className="size-4" />
            משימה חדשה
          </Button>
        }
      />
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>משימה חדשה</DialogTitle>
        </DialogHeader>
        <TaskForm projects={projects} onSuccess={() => setOpen(false)} submitLabel="צור משימה" />
      </DialogContent>
    </Dialog>
  )
}
