import { describe, expect, it } from 'vitest'
import { csvEscape, rowsToCsv } from './admin'

describe('CSV administrativo', () => {
  it('escapa comas y comillas', () => expect(csvEscape('Resina, "A"')).toBe('"Resina, ""A"""'))
  it('exporta encabezados y filas', () => expect(rowsToCsv([{ sku: 'A1', costo: 10 }])).toBe('sku,costo\nA1,10'))
  it('tolera lotes vacíos', () => expect(rowsToCsv([])).toBe(''))
})
