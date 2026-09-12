import { describe, expect, it } from 'vitest'
import { databaseRowToQuote, mergeQuoteHistories, quoteToDatabaseRows } from './sharedQuotes'
import type { SavedQuote } from './quote'

const quote: SavedQuote = {
  meta: { number: 'GP-1', client: 'Cliente', contact: 'Ana', phone: '11', email: '', notes: '', paymentMethod: 'transferencia', priceMode: 'automatico', validDays: 7, discountPercent: 0, surchargePercent: 0, exchangeRate: 1530, outputCurrency: 'USD', status: 'borrador', createdAt: '2026-09-12T02:00:00Z' },
  lines: [{ id: 'v1', productId: 'p1', productName: 'Producto', brand: 'Grupo Poliplast', family: 'Resinplast', quantity: 2, variant: { id: 'v1', product_id: 'p1', sku: 'SKU-1', name: 'Variante', unit: 'kg', attributes: {}, active: true, hasTechnicalDoc: false, prices: [] } }],
  updatedAt: '2026-09-12T02:01:00Z',
}

describe('persistencia compartida de cotizaciones', () => {
  it('genera encabezado auditable y snapshot por renglón', () => {
    const rows = quoteToDatabaseRows(quote, 'user-1')
    expect(rows.header.owner_id).toBe('user-1')
    expect(rows.header.quote_number).toBe('GP-1')
    expect(rows.items[0].line_snapshot).toEqual(quote.lines[0])
    expect(rows.items[0].unit_amount).toBeNull()
  })

  it('reconstruye solo renglones activos sin consultar el catálogo actual', () => {
    const rebuilt = databaseRowToQuote({ ...quoteToDatabaseRows(quote, 'user-1').header, sales_quote_items: [{ active: true, line_snapshot: quote.lines[0] }, { active: false, line_snapshot: { id: 'viejo' } }] })
    expect(rebuilt?.lines).toEqual(quote.lines)
    expect(rebuilt?.meta.client).toBe('Cliente')
  })

  it('fusiona respaldo local y remoto conservando la versión más reciente', () => {
    const older = { ...quote, updatedAt: '2026-09-12T02:00:00Z' }
    const newer = { ...quote, meta: { ...quote.meta, client: 'Actualizado' }, updatedAt: '2026-09-12T03:00:00Z' }
    expect(mergeQuoteHistories([older], [newer])).toEqual([newer])
  })
})
