import { describe, expect, it } from 'vitest'
import { groupByColorVariant, stripColorWord } from './colorVariants'

describe('stripColorWord', () => {
  it('saca la palabra de color y no toca el resto', () => {
    expect(stripColorWord('BALDE 10 LITROS AZUL CON MANIJA/TAPA')).toBe('BALDE 10 LITROS CON MANIJA/TAPA')
  })
  it('deja igual un nombre sin color', () => {
    expect(stripColorWord('RESINA NAUTICA VIRGEN')).toBe('RESINA NAUTICA VIRGEN')
  })
  it('saca la palabra de color aunque este acentuada en el nombre original', () => {
    expect(stripColorWord('SILICONA MARRÓN X4')).toBe('SILICONA X4')
  })
})

describe('groupByColorVariant', () => {
  const p = (name: string) => ({ name })
  it('agrupa el mismo balde en distintos colores con el mismo precio', () => {
    const products = [p('BALDE 10 LITROS AZUL CON MANIJA/TAPA'), p('BALDE 10 LITROS ROJO CON MANIJA/TAPA'), p('BALDE 10 LITROS VERDE CON MANIJA/TAPA')]
    const groups = groupByColorVariant(products, (x) => x.name, () => '6.86')
    expect(groups).toHaveLength(1)
    expect(groups[0].colorOptions.map((option) => option.color).sort()).toEqual(['azul', 'rojo', 'verde'])
  })
  it('no agrupa si el precio es distinto', () => {
    const products = [p('BALDE 10 LITROS AZUL CON MANIJA/TAPA'), p('BALDE 10 LITROS ROJO CON MANIJA/TAPA')]
    const prices = new Map([[products[0], '6.86'], [products[1], '7.50']])
    const groups = groupByColorVariant(products, (x) => x.name, (x) => prices.get(x)!)
    expect(groups).toHaveLength(2)
    expect(groups.every((group) => group.colorOptions.length === 0)).toBe(true)
  })
  it('no agrupa productos sin color detectado, aunque tengan nombres parecidos', () => {
    const products = [p('RESINA NAUTICA VIRGEN'), p('RESINA NAUTICA PREACELERADA')]
    const groups = groupByColorVariant(products, (x) => x.name, () => 'mismo-precio')
    expect(groups).toHaveLength(2)
    expect(groups.every((group) => group.colorOptions.length === 0)).toBe(true)
  })
  it('no agrupa 60x35 con 70x40 aunque comparta color, porque el nombre sin color ya difiere', () => {
    const products = [p('ALMOHADA 60X35 AZUL'), p('ALMOHADA 70X40 AZUL')]
    const groups = groupByColorVariant(products, (x) => x.name, () => 'mismo-precio')
    expect(groups).toHaveLength(2)
  })
})
