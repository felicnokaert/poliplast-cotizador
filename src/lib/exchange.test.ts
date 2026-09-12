import { describe, expect, it } from 'vitest'
import { parseBnaDollar, parseOfficialDollar } from './exchange'

describe('tipo de cambio oficial', () => {
  it('lee el valor de venta', () => expect(parseOfficialDollar({ compra: 1200, venta: 1255.5 })).toBe(1255.5))
  it('rechaza valores vacíos o inválidos', () => { expect(parseOfficialDollar({ venta: 0 })).toBeNull(); expect(parseOfficialDollar(null)).toBeNull() })
})

describe('respuesta normalizada de BNA', () => {
  it('acepta vendedor billete con fecha', () => {
    expect(parseBnaDollar({ rate: 1530, source: 'BNA · Dólar billete vendedor', fetchedAt: '2026-09-12T10:00:00Z', quotationDate: '11/9/2026' }))
      .toEqual({ rate: 1530, source: 'BNA · Dólar billete vendedor · cotización 11/9/2026', fetchedAt: '2026-09-12T10:00:00Z', quotationDate: '11/9/2026' })
  })
  it('rechaza valores inválidos', () => { expect(parseBnaDollar({ rate: 0 })).toBeNull(); expect(parseBnaDollar(null)).toBeNull() })
})
