import { describe, expect, it } from 'vitest'
import { parseOfficialDollar } from './exchange'

describe('tipo de cambio oficial', () => {
  it('lee el valor de venta', () => expect(parseOfficialDollar({ compra: 1200, venta: 1255.5 })).toBe(1255.5))
  it('rechaza valores vacíos o inválidos', () => { expect(parseOfficialDollar({ venta: 0 })).toBeNull(); expect(parseOfficialDollar(null)).toBeNull() })
})
