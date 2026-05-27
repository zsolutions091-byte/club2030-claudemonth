'use client'

import { useState, useTransition } from 'react'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PROJECT_COLOR_PRESETS } from '@/lib/validators/project'
import { createProject } from '@/lib/actions/projects'

export function ProjectCreateDialog() {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [color, setColor] = useState<string>(PROJECT_COLOR_PRESETS[0])
  const [icon, setIcon] = useState('')
  const [pending, startTransition] = useTransition()

  const reset = () => {
    setName('')
    setColor(PROJECT_COLOR_PRESETS[0])
    setIcon('')
  }

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    startTransition(async () => {
      try {
        await createProject({ name, color, icon: icon || undefined })
        toast.success('פרויקט נוצר')
        reset()
        setOpen(false)
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'שגיאה ביצירת פרויקט'
        toast.error(msg)
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="ghost" size="icon" className="size-6" aria-label="פרויקט חדש">
            <Plus className="size-4" />
          </Button>
        }
      />

      <DialogContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>פרויקט חדש</DialogTitle>
            <DialogDescription>הוספת פרויקט לארגון משימות</DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="project-name">שם</Label>
            <Input
              id="project-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="עבודה / בית / ..."
              required
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="project-icon">אימוג&apos;י (אופציונלי)</Label>
            <Input
              id="project-icon"
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              placeholder="📁"
              maxLength={4}
              className="w-20"
            />
          </div>

          <div className="space-y-2">
            <Label>צבע</Label>
            <div className="flex flex-wrap gap-2">
              {PROJECT_COLOR_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  aria-label={`צבע ${preset}`}
                  className={`size-7 rounded-full border-2 transition-all ${
                    color === preset ? 'border-foreground scale-110' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: preset }}
                  onClick={() => setColor(preset)}
                />
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              ביטול
            </Button>
            <Button type="submit" disabled={pending || !name.trim()}>
              {pending ? 'שומר…' : 'שמור'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
