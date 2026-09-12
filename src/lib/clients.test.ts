import { describe, expect, it } from 'vitest'
import { extractCommercialClients } from './clients'

describe('clientes del CRM', () => {
  it('extrae empresa y contacto principal sin duplicar datos', () => {
    const result = extractCommercialClients({ clients: [{ id: '1', company: 'ACME', contacts: [{ name: 'Ana', phone: '123', email: 'a@a.com', primary: true }] }] })
    expect(result).toEqual([{ id: '1', company: 'ACME', legalName: '', cuit: '', contact: 'Ana', phone: '123', email: 'a@a.com' }])
  })
  it('ignora filas sin empresa', () => expect(extractCommercialClients({ clients: [{ id: '1' }] })).toEqual([]))
})
