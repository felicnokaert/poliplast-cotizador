import { describe, expect, it } from 'vitest'
import { isCrmOrigin, isEmbeddedInCrm } from './embed'

describe('cotizador adentro del CRM', () => {
  it('solo acepta la sesión que viene del CRM', () => {
    expect(isCrmOrigin('https://poli-crm.vercel.app')).toBe(true)
    expect(isCrmOrigin('https://otro-sitio.com')).toBe(false)
    expect(isCrmOrigin('https://poli-crm.vercel.app.evil.com')).toBe(false)
  })
  it('solo se considera embebido con ?embed=1 y dentro de un iframe', () => {
    const top = { location: { search: '?embed=1' } } as unknown as Window
    ;(top as unknown as { parent: Window }).parent = top
    expect(isEmbeddedInCrm(top)).toBe(false)
    const framed = { location: { search: '?embed=1' }, parent: {} } as unknown as Window
    expect(isEmbeddedInCrm(framed)).toBe(true)
    const plain = { location: { search: '' }, parent: {} } as unknown as Window
    expect(isEmbeddedInCrm(plain)).toBe(false)
  })
})
