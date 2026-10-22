import { describe, expect, it } from 'vitest'
import { addBusinessDays, monthKeyAR, todayAR } from './dates'

describe('fechas en hora de Argentina', () => {
  it('después de las 21:00 argentinas "hoy" sigue siendo el mismo día', () => {
    expect(todayAR('2026-10-23T00:30:00Z')).toBe('2026-10-22') // 21:30 del jueves en Argentina
    expect(todayAR('2026-10-23T03:00:00Z')).toBe('2026-10-23')
  })
  it('el mes también se mide en hora de Argentina', () => {
    expect(monthKeyAR('2026-11-01T01:00:00Z')).toBe('2026-10')
    expect(monthKeyAR('2026-11-01T03:00:00Z')).toBe('2026-11')
  })
  it('suma días hábiles saltando fines de semana', () => {
    expect(addBusinessDays('2026-10-20', 2)).toBe('2026-10-22') // martes → jueves
    expect(addBusinessDays('2026-10-22', 2)).toBe('2026-10-26') // jueves → viernes, lunes
    expect(addBusinessDays('2026-10-23', 2)).toBe('2026-10-27') // viernes → lunes, martes
    expect(addBusinessDays('2026-10-24', 1)).toBe('2026-10-26') // sábado → lunes
  })
})
