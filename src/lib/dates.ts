// Fechas en hora de Argentina (UTC-3, sin horario de verano). Pasadas las 21:00 en Argentina, "hoy" en UTC ya es mañana:
// usar siempre estas funciones para vigencias de precios, meses y vencimientos, nunca toISOString() directo.
const AR_OFFSET_MS = 3 * 3_600_000

export const todayAR = (now: Date | string | number = Date.now()): string => new Date(new Date(now).getTime() - AR_OFFSET_MS).toISOString().slice(0, 10)

/** Mes (AAAA-MM) de un instante, en hora de Argentina. */
export const monthKeyAR = (instant: string | number | Date): string => todayAR(instant).slice(0, 7)

const addDaysTo = (date: string, days: number) => { const d = new Date(`${date}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10) }
const isWeekend = (date: string) => [0, 6].includes(new Date(`${date}T12:00:00Z`).getUTCDay())

/** Suma `days` días HÁBILES (lunes a viernes) a una fecha AAAA-MM-DD. No conoce feriados. */
export function addBusinessDays(date: string, days: number): string {
  let current = date
  let remaining = days
  while (remaining > 0) {
    current = addDaysTo(current, 1)
    if (!isWeekend(current)) remaining -= 1
  }
  return current
}
