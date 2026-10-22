import { describe, expect, it } from 'vitest'
import { frequentlyTogether } from './suggestions'
import type { QuoteLine, SavedQuote } from './quote'

const line = (productId: string, name: string, variantId = `${productId}-v`) => ({ id: variantId, productId, productName: name, brand: 'X', family: 'F', quantity: 1, variant: { id: variantId } }) as unknown as QuoteLine
const quote = (number: string, ...lines: QuoteLine[]) => ({ meta: { number }, lines, updatedAt: '2026-10-01T10:00:00Z' }) as unknown as SavedQuote

describe('se suele cotizar junto', () => {
  const history = [
    quote('1', line('resina', 'Resina epoxi'), line('catalizador', 'Catalizador'), line('pigmento', 'Pigmento')),
    quote('2', line('resina', 'Resina epoxi'), line('catalizador', 'Catalizador', 'cat-2')),
    quote('3', line('resina', 'Resina epoxi'), line('catalizador', 'Catalizador', 'cat-2')),
    quote('4', line('balde', 'Balde'), line('guantes', 'Guantes')),
  ]
  it('sin nada en la cotización no sugiere', () => {
    expect(frequentlyTogether(history, [])).toEqual([])
  })
  it('sugiere lo que más acompañó a lo actual, con la presentación habitual, y exige 2 coincidencias', () => {
    const result = frequentlyTogether(history, [line('resina', 'Resina epoxi')])
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ productId: 'catalizador', together: 3, variantId: 'cat-2' })
    expect(result[0].share).toBe(1)
  })
  it('no repite lo que ya está y no cuenta la cotización que se está editando', () => {
    expect(frequentlyTogether(history, [line('resina', 'R'), line('catalizador', 'C')])).toEqual([])
    expect(frequentlyTogether(history, [line('resina', 'R')], { excludeNumber: '2' })[0].together).toBe(2)
  })
  it('no sugiere cuando el historial no tiene relación', () => {
    expect(frequentlyTogether(history, [line('otro', 'Otro')])).toEqual([])
  })
})
