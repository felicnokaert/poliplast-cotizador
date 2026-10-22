import { describe, expect, it, vi } from 'vitest'

vi.mock('./supabase', () => ({ supabase: { from: vi.fn() } }))

import { customerInsights, nameKey, ownQuotesFor, parseArNumber, searchWord, summarizeCustomer, type ComprobanteRow } from './customerHistory'
import type { SavedQuote } from './quote'

const row = (tipo: string, fecha: string, total: string, cliente = 'Carrocerías Norte S.A.', company = 'COMARG'): ComprobanteRow => ({ company, tipo, fecha, cliente, total })

describe('ficha del cliente desde Contabilium', () => {
  it('empareja nombres como el CRM y entiende los importes argentinos', () => {
    expect(nameKey('Carrocerías Norte S.A.')).toBe(nameKey('NORTE CARROCERIAS'))
    expect(parseArNumber('39.025,52')).toBe(39025.52)
  })
  it('resume compras, estado, frecuencia y atraso; las notas de crédito restan y la cotización no es venta', () => {
    const rows = [
      row('FCA', '2026-01-10', '100.000,00'), row('FCA', '2026-03-10', '120.000,00'), row('FCA', '2026-05-10', '110.000,00'),
      row('NCA', '2026-05-12', '10.000,00'), row('COT', '2026-09-01', '8.000,00'),
      row('FCA', '2026-05-10', '999,00', 'Otro cliente SRL'),
    ]
    const summary = summarizeCustomer(rows, ['Carrocerías Norte'], '2026-10-21')!
    expect(summary).toMatchObject({ purchaseCount: 3, lastPurchase: '2026-05-10', daysSince: 164, status: 'dormido', purchases24: 3, total24: 320000, frequencyDays: 60, overdueDays: 104, quotesInContabilium: 1, lastQuote: '2026-09-01' })
  })
  it('sin facturas con ese nombre devuelve null: no se inventa nada', () => {
    expect(summarizeCustomer([row('FCA', '2026-01-10', '1,00', 'Otro')], ['Carrocerías Norte'])).toBeNull()
    expect(summarizeCustomer([], [''])).toBeNull()
  })
  it('busca por la palabra más característica, con comodín en los acentos', () => {
    expect(searchWord('Carrocerías Norte S.A.')).toBe('Carrocerias')
    expect(searchWord('SA')).toBe('')
  })
  it('avisa cuando dejó de comprar o cotiza y no cierra, y calla cuando no hay nada para decir', () => {
    const quote = (n: string, status: SavedQuote['meta']['status']) => ({ meta: { number: n, client: 'Carrocerías Norte', status }, lines: [], updatedAt: '' }) as unknown as SavedQuote
    const own = ownQuotesFor([quote('1', 'enviada'), quote('2', 'rechazada'), quote('3', 'enviada'), quote('4', 'borrador'), quote('5', 'enviada')], ['Carrocerías Norte S.A.'], '5')
    expect(own).toHaveLength(3)
    const summary = summarizeCustomer([row('FCA', '2026-01-10', '1.000,00'), row('FCA', '2026-03-10', '1.000,00')], ['Carrocerías Norte'], '2026-10-21')
    const lines = customerInsights(summary, own)
    expect(lines[0]).toMatch(/No compra hace 225 días/)
    expect(lines[1]).toMatch(/3 cotizaciones/)
    expect(customerInsights(null, [])).toEqual([])
  })
})
