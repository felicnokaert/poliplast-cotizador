import { describe, expect, it } from 'vitest'
import { aplicarTema, temaValido } from './tema'

describe('modo oscuro', () => {
  it('solo acepta dark o light y lo pone en <html>', () => {
    expect(temaValido('dark')).toBe('dark')
    expect(temaValido('x')).toBeNull()
    const root = document.createElement('html')
    aplicarTema('dark', root)
    expect(root.dataset.theme).toBe('dark')
    aplicarTema(null, root)
    expect(root.dataset.theme).toBeUndefined()
  })
})
