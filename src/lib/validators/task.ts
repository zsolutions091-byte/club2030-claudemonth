import { z } from 'zod'

export const TaskStatusEnum = z.enum(['OPEN', 'IN_PROGRESS', 'WAITING', 'DONE', 'CANCELLED'])
export const TaskPriorityEnum = z.enum(['P1', 'P2', 'P3', 'P4'])

export type TaskStatusValue = z.infer<typeof TaskStatusEnum>
export type TaskPriorityValue = z.infer<typeof TaskPriorityEnum>

const isoDateString = z
  .string()
  .trim()
  .min(1)
  .refine((v) => !Number.isNaN(Date.parse(v)), 'תאריך לא תקין')

export const taskCreateSchema = z.object({
  title: z.string().trim().min(1, 'יש להזין כותרת').max(500, 'כותרת ארוכה מדי'),
  description: z.string().trim().max(10_000).optional().or(z.literal('').transform(() => undefined)),
  status: TaskStatusEnum.default('OPEN'),
  priority: TaskPriorityEnum.default('P4'),
  dueDate: isoDateString.optional().or(z.literal('').transform(() => undefined)),
  dueHasTime: z.boolean().default(false),
  startDate: isoDateString.optional().or(z.literal('').transform(() => undefined)),
  estimatedMinutes: z.coerce.number().int().positive().optional(),
  projectId: z.string().trim().min(1).optional().or(z.literal('').transform(() => undefined)),
})

export const taskUpdateSchema = taskCreateSchema.partial()

export type TaskCreateInput = z.infer<typeof taskCreateSchema>
export type TaskUpdateInput = z.infer<typeof taskUpdateSchema>

export const STATUS_LABELS: Record<TaskStatusValue, string> = {
  OPEN: 'פתוחה',
  IN_PROGRESS: 'בעבודה',
  WAITING: 'ממתינה',
  DONE: 'הושלמה',
  CANCELLED: 'בוטלה',
}

export const PRIORITY_LABELS: Record<TaskPriorityValue, string> = {
  P1: 'P1 — דחוף',
  P2: 'P2 — גבוה',
  P3: 'P3 — בינוני',
  P4: 'P4 — נמוך',
}

// PRD §5.1 - palette
export const PRIORITY_COLORS: Record<TaskPriorityValue, string> = {
  P1: '#E63CA8', // magenta
  P2: '#F9D648', // yellow
  P3: '#4FD2D4', // cyan
  P4: '#9999A8', // muted
}
