import { describe, expect, it } from 'vitest'
import { followUpMessage, followUps, quoteInsights, statusBreakdown, topProducts } from './quoteInsights'
import type { SavedQuote } from './quote'

const list = { id: 'pl', name: 'USD', brand: 'X', currency: 'USD' as const, vat_rate: 0.21, valid_from: '2026-01-01', valid_until: null, status: 'vigente' as const }
const quote = (number: string, createdAt: string, status: SavedQuote['meta']['status'], amount: number, quantity = 1): SavedQuote => ({
  meta: { number, client: 'C', contact: '', phone: '', email: '', notes: '', paymentMethod: 'transferencia', priceMode: 'automatico', validDays: 7, discountPercent: 0, surchargePercent: 0, exchangeRate: 1000, outputCurrency: 'USD', status, createdAt },
  lines: [{ id: number, productId: 'p', productName: 'P', brand: 'X', family: 'F', quantity, variant: { id: 'v', product_id: 'p', sku: 'S', name: 'V', unit: 'kg', attributes: {}, active: true, hasTechnicalDoc: false, prices: [{ id: 'pr', price_list_id: 'pl', variant_id: 'v', min_quantity: 1, max_quantity: null, amount, status: 'confirmado', price_list: list }] } }],
  updatedAt: createdAt,
})

describe('resumen de cotizaciones', () => {
  it('suma por mes en dólares y cuenta estados', () => {
    const result = quoteInsights([
      quote('1', '2026-10-10T10:00:00Z', 'enviada', 100, 2),
      quote('2', '2026-10-12T10:00:00Z', 'aceptada', 50),
      quote('3', '2026-09-01T10:00:00Z', 'rechazada', 10),
      quote('4', '2025-01-01T10:00:00Z', 'aceptada', 999),
    ], [], new Date('2026-10-16T12:00:00Z'))
    expect(result.bars.map((bar) => bar.label)).toEqual(['May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct'])
    expect(result.monthCount).toBe(2)
    expect(result.monthUsd).toBe(250)
    expect(result.bars[4].usd).toBe(10)
    expect(result.waiting).toBe(1)
    expect(result.acceptance).toBe(67)
  })
})

describe('inteligencia de seguimiento', () => {
  const today = new Date('2026-10-20T12:00:00Z')
  it('lista las enviadas con 3 o más días sin movimiento, la más vieja primero', () => {
    const items = followUps([
      quote('1', '2026-10-19T10:00:00Z', 'enviada', 10),
      quote('2', '2026-10-10T10:00:00Z', 'enviada', 20),
      quote('3', '2026-10-01T10:00:00Z', 'aceptada', 30),
      quote('4', '2026-10-15T10:00:00Z', 'enviada', 40),
    ], [], today)
    expect(items.map((item) => item.quote.meta.number)).toEqual(['2', '4'])
    expect(items[0].days).toBe(10)
    expect(items[0].usd).toBe(20)
  })
  it('arma un mensaje de seguimiento sin prometer nada', () => {
    const base = quote('A-7', '2026-10-10T10:00:00Z', 'enviada', 10)
    const message = followUpMessage({ ...base, meta: { ...base.meta, contact: 'marta gómez' } })
    expect(message).toMatch(/^Hola marta,/)
    expect(message).toContain('A-7')
    expect(message).not.toMatch(/descuento|\$|USD/i)
  })
  it('cuenta estados y productos más cotizados', () => {
    const quotes = [quote('1', '2026-10-01T10:00:00Z', 'enviada', 1), quote('2', '2026-10-02T10:00:00Z', 'enviada', 1), quote('3', '2026-10-03T10:00:00Z', 'aceptada', 1)]
    expect(statusBreakdown(quotes)).toEqual([{ status: 'borrador', count: 0 }, { status: 'enviada', count: 2 }, { status: 'aceptada', count: 1 }, { status: 'rechazada', count: 0 }])
    expect(topProducts(quotes)).toEqual([{ name: 'P', quotes: 3 }])
  })
})
