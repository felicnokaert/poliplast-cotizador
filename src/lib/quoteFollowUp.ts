import { supabase } from './supabase'
import type { SavedQuote } from './quote'

// Seguimiento de cotizaciones en el CRM: al dejar una cotización como "enviada" se crea una tarea en Tareas del CRM
// (a 2 días hábiles, igual que el primer contacto en Prospección); si después se acepta o se rechaza, la tarea se
// marca hecha. Una sola tarea por cotización (autoKey), así guardar varias veces no duplica nada.

export const QUOTE_FOLLOW_UP_SOURCE = 'quote-followup'
export const QUOTE_FOLLOW_UP_DAYS = 2

export interface CrmTask { id: string; autoKey?: string; done?: boolean; [key: string]: unknown }

const addDays = (date: string, days: number) => { const d = new Date(`${date}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10) }
const isWeekend = (date: string) => [0, 6].includes(new Date(`${date}T12:00:00Z`).getUTCDay())

/** Fecha de vencimiento: `days` días corridos desde hoy (hora de Argentina), salteando sábado y domingo. */
export function followUpDueDate(now = new Date().toISOString(), days = QUOTE_FOLLOW_UP_DAYS): string {
  let due = addDays(new Date(Date.parse(now) - 3 * 3_600_000).toISOString().slice(0, 10), days)
  while (isWeekend(due)) due = addDays(due, 1)
  return due
}

export function quoteFollowUpTask(quote: SavedQuote, { taskId, clientId = '', now = new Date().toISOString() }: { taskId: string; clientId?: string; now?: string }): CrmTask {
  const company = quote.meta.client || 'cliente sin nombre'
  return {
    id: taskId,
    clientId: clientId || undefined,
    company,
    title: `Seguimiento de la cotización N° ${quote.meta.number} a ${company}: ¿la vio? ¿Ajustamos cantidades u otra opción?`,
    dueDate: followUpDueDate(now),
    cadence: 'Única',
    priority: 'Media',
    trigger: `Cotización ${quote.meta.number} enviada`,
    done: false,
    createdAt: now,
    updatedAt: now,
    createdBy: 'sistema',
    source: QUOTE_FOLLOW_UP_SOURCE,
    autoKey: `${QUOTE_FOLLOW_UP_SOURCE}:${quote.meta.number}`,
  }
}

/**
 * Devuelve las tareas nuevas según el estado de la cotización: enviada → crea el seguimiento si no existe;
 * aceptada o rechazada → marca hecho el seguimiento pendiente. Cualquier otro estado no toca nada.
 */
export function applyQuoteFollowUp(tasks: CrmTask[], quote: SavedQuote, { clientId = '', newId, now = new Date().toISOString() }: { clientId?: string; newId: () => string; now?: string }): { tasks: CrmTask[]; change: 'creada' | 'cerrada' | '' } {
  const key = `${QUOTE_FOLLOW_UP_SOURCE}:${quote.meta.number}`
  const existing = tasks.find((task) => task.autoKey === key)
  const status = quote.meta.status
  if (status === 'enviada' && !existing) return { tasks: [...tasks, quoteFollowUpTask(quote, { taskId: newId(), clientId, now })], change: 'creada' }
  if ((status === 'aceptada' || status === 'rechazada') && existing && !existing.done) {
    return { tasks: tasks.map((task) => (task.autoKey === key ? { ...task, done: true, doneAt: now, updatedAt: now } : task)), change: 'cerrada' }
  }
  return { tasks, change: '' }
}

export async function syncQuoteFollowUpInCrm(userId: string, email: string, quote: SavedQuote, clientId = ''): Promise<'creada' | 'cerrada' | ''> {
  if (!['enviada', 'aceptada', 'rechazada'].includes(quote.meta.status) || !quote.meta.number) return ''
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data: row, error } = await supabase.from('workspace_states').select('data,updated_at').eq('workspace_key', userId).maybeSingle()
    if (error) throw error
    if (!row) return ''
    const state = (row.data ?? {}) as { tasks?: CrmTask[] }
    const result = applyQuoteFollowUp(Array.isArray(state.tasks) ? state.tasks : [], quote, { clientId, newId: () => crypto.randomUUID() })
    if (!result.change) return ''
    const { data: saved, error: saveError } = await supabase
      .from('workspace_states')
      .update({ data: { ...state, tasks: result.tasks }, updated_by: userId, updated_by_email: email, updated_at: new Date().toISOString() })
      .eq('workspace_key', userId)
      .eq('updated_at', row.updated_at)
      .select('updated_at')
    if (saveError) throw saveError
    if (saved && saved.length) return result.change
  }
  throw new Error('El CRM se estaba guardando; probá de nuevo.')
}
