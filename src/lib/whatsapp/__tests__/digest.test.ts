import { describe, it, expect } from 'vitest'
import { formatDigest, digestOrder, type DigestTask } from '@/lib/whatsapp/digest'

const t = (id: string, title: string): DigestTask => ({ id, title })

describe('formatDigest', () => {
  it('numbers today then overdue continuing the numbering', () => {
    const input = { today: [t('a', 'לקנות חלב'), t('b', 'להתקשר לרופא')], overdue: [t('c', 'דוח')] }
    const msg = formatDigest(input)
    expect(msg).toContain('משימות להיום')
    expect(msg).toContain('1. לקנות חלב')
    expect(msg).toContain('2. להתקשר לרופא')
    expect(msg).toContain('⚠️ באיחור')
    expect(msg).toContain('3. דוח')
    expect(digestOrder(input)).toEqual(['a', 'b', 'c'])
  })

  it('empty day returns the friendly no-tasks message', () => {
    expect(formatDigest({ today: [], overdue: [] })).toContain('אין משימות להיום')
    expect(digestOrder({ today: [], overdue: [] })).toEqual([])
  })
})
