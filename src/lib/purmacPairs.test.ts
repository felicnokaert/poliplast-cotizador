import { describe, expect, it } from 'vitest'
import { pairPurmacGenerics } from './purmacPairs'

const p = (id: string, sku: string, photo_path: string | null = null) => ({ id, sku, photo_path })
const skuOf = (product: { sku: string }) => product.sku

describe('pairPurmacGenerics', () => {
  it('empareja la pieza original con la Purmac aunque la Purmac lleve espacio y sufijo -1', () => {
    const graco = p('a', '118665')
    const purmac = p('b', 'PM 118665-1')
    const { mains, pairs } = pairPurmacGenerics([graco, purmac], skuOf)
    expect(mains.map((x) => x.id)).toEqual(['a'])
    expect(pairs.get('a')).toEqual({ generic: graco, purmac })
  })

  it('empareja PM15B210 con 15B210', () => {
    const { mains, pairs } = pairPurmacGenerics([p('a', '15B210'), p('b', 'PM15B210')], skuOf)
    expect(mains).toHaveLength(1)
    expect(pairs.size).toBe(1)
  })

  it('la ficha principal es la que ya tiene foto; si ninguna, la original', () => {
    const conFoto = pairPurmacGenerics([p('a', '15B210'), p('b', 'PM15B210', 'foto.jpg')], skuOf)
    expect([...conFoto.pairs.keys()]).toEqual(['b'])
    const sinFoto = pairPurmacGenerics([p('a', '15B210'), p('b', 'PM15B210')], skuOf)
    expect([...sinFoto.pairs.keys()]).toEqual(['a'])
  })

  it('no toca una pieza PM sin su original ni una original sin su PM', () => {
    const items = [p('a', 'PM490'), p('b', '246349'), p('c', 'PMB4242')]
    const { mains, pairs } = pairPurmacGenerics(items, skuOf)
    expect(mains).toHaveLength(3)
    expect(pairs.size).toBe(0)
  })

  it('no empareja códigos parecidos pero distintos', () => {
    const { pairs } = pairPurmacGenerics([p('a', '15B210'), p('b', 'PM15B2101')], skuOf)
    expect(pairs.size).toBe(0)
  })
})
