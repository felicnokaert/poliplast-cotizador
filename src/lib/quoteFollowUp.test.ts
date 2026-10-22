import { describe, expect, it, vi } from 'vitest'

vi.mock('./supabase', () => ({ supabase: { from: vi.fn() } }))

import { applyQuoteFollowUp, followUpDueDate, quoteFollowUpTask } from './quoteFollowUp'
import type { SavedQuote } from './quote'

const quote = (status: SavedQuote['meta']['status'], number = '0007') => ({ meta: { number, client: 'Frío Sur SRL', status }, lines: [], updatedAt: '' }) as unknown as SavedQuote
const ids = () => { let n = 0; return () => `task-${++n}` }

describe('seguimiento de cotizaciones en el CRM', () => {
  it('vence a 2 días hábiles y salta el fin de semana (hora de Argentina)', () => {
    expect(followUpDueDate('2026-10-20T15:00:00Z')).toBe('2026-10-22') // martes → jueves
    expect(followUpDueDate('2026-10-22T15:00:00Z')).toBe('2026-10-26') // jueves → viernes, lunes (2 días hábiles)
    expect(followUpDueDate('2026-10-23T15:00:00Z')).toBe('2026-10-27') // viernes → lunes, martes
  })
  it('enviada crea una sola tarea con la forma de las tareas del CRM', () => {
    const first = applyQuoteFollowUp([], quote('enviada'), { clientId: 'c1', newId: ids(), now: '2026-10-20T15:00:00Z' })
    expect(first.change).toBe('creada')
    expect(first.tasks[0]).toMatchObject({ id: 'task-1', clientId: 'c1', company: 'Frío Sur SRL', dueDate: '2026-10-22', done: false, source: 'quote-followup', autoKey: 'quote-followup:0007', createdBy: 'sistema' })
    expect(first.tasks[0].title).toContain('N° 0007')
    const again = applyQuoteFollowUp(first.tasks, quote('enviada'), { newId: ids() })
    expect(again.change).toBe('')
    expect(again.tasks).toHaveLength(1)
  })
  it('aceptada o rechazada cierra el seguimiento pendiente; borrador no toca nada', () => {
    const created = applyQuoteFollowUp([], quote('enviada'), { newId: ids() }).tasks
    expect(applyQuoteFollowUp(created, quote('borrador'), { newId: ids() }).change).toBe('')
    const closed = applyQuoteFollowUp(created, quote('aceptada'), { newId: ids(), now: '2026-10-21T10:00:00Z' })
    expect(closed.change).toBe('cerrada')
    expect(closed.tasks[0]).toMatchObject({ done: true, doneAt: '2026-10-21T10:00:00Z' })
    expect(applyQuoteFollowUp(closed.tasks, quote('rechazada'), { newId: ids() }).change).toBe('')
    expect(applyQuoteFollowUp([], quote('aceptada'), { newId: ids() }).tasks).toEqual([])
  })
  it('sin cliente usa un nombre neutro', () => {
    const task = quoteFollowUpTask({ ...quote('enviada'), meta: { ...quote('enviada').meta, client: '' } }, { taskId: 'x' })
    expect(task.company).toBe('cliente sin nombre')
  })
})
