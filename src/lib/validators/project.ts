import { z } from 'zod'

const hexColor = z
  .string()
  .trim()
  .regex(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/, 'צבע HEX לא תקין')

export const projectCreateSchema = z.object({
  name: z.string().trim().min(1, 'יש להזין שם').max(120),
  color: hexColor.default('#4FD2D4'),
  icon: z.string().trim().max(8).optional().or(z.literal('').transform(() => undefined)),
  parentId: z.string().trim().min(1).optional().or(z.literal('').transform(() => undefined)),
})

export const projectUpdateSchema = projectCreateSchema.partial()

export type ProjectCreateInput = z.infer<typeof projectCreateSchema>
export type ProjectUpdateInput = z.infer<typeof projectUpdateSchema>

// PRD §5.1 — color presets
export const PROJECT_COLOR_PRESETS = [
  '#E63CA8', // magenta
  '#4FD2D4', // cyan
  '#F9D648', // yellow
  '#9999A8', // muted
  '#7C3AED', // purple
  '#10B981', // green
  '#F97316', // orange
  '#EF4444', // red
] as const
