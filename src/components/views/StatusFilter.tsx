'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { STATUS_LABELS, type TaskStatusValue } from '@/lib/validators/task'

const STATUSES: TaskStatusValue[] = ['OPEN', 'IN_PROGRESS', 'WAITING', 'DONE', 'CANCELLED']

export function StatusFilter({ active }: { active: TaskStatusValue[] }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()

  const toggle = (status: TaskStatusValue) => {
    const next = new Set(active)
    if (next.has(status)) {
      next.delete(status)
    } else {
      next.add(status)
    }
    const newParams = new URLSearchParams(params.toString())
    if (next.size === 0) {
      newParams.delete('status')
    } else {
      newParams.set('status', Array.from(next).join(','))
    }
    const qs = newParams.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname)
  }

  const clear = () => {
    const newParams = new URLSearchParams(params.toString())
    newParams.delete('status')
    const qs = newParams.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname)
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {STATUSES.map((status) => {
        const isActive = active.includes(status)
        return (
          <Button
            key={status}
            type="button"
            size="sm"
            variant={isActive ? 'default' : 'outline'}
            onClick={() => toggle(status)}
            className="h-7 text-xs"
          >
            {STATUS_LABELS[status]}
          </Button>
        )
      })}
      {active.length > 0 && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={clear}
          className="h-7 text-xs text-muted-foreground"
        >
          נקה
        </Button>
      )}
    </div>
  )
}
