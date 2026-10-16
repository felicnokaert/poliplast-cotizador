import { describe, expect, it } from 'vitest'
import { extractCommercialClients } from './clients'

describe('clientes del CRM', () => {
  it('extrae empresa y contacto principal sin duplicar datos', () => {
    const result = extractCommercialClients({ clients: [{ id: '1', company: 'ACME', contacts: [{ name: 'Ana', phone: '123', email: 'a@a.com', primary: true }] }] })
    expect(result).toEqual([{ id: '1', company: 'ACME', legalName: '', cuit: '', contact: 'Ana', phone: '123', phones: ['123'], email: 'a@a.com' }])
  })
  it('ignora filas sin empresa', () => expect(extractCommercialClients({ clients: [{ id: '1' }] })).toEqual([]))
})

import { applyQuotedMark, mergeClientLists, type CommercialClient } from './clients'

const c = (id: string, company: string, origin: CommercialClient['origin'] = 'mio'): CommercialClient => ({ id, company, legalName: '', cuit: '', contact: '', phone: '', phones: [], email: '', origin })

describe('clientes del CRM para cotizar', () => {
  it('une mis empresas, el directorio y el histórico sin repetir (manda la primera lista)', () => {
    const merged = mergeClientLists([c('1', 'Corralón Sur')], [c('1', 'Corralón Sur', 'equipo'), c('2', 'CORRALÓN  sur', 'equipo'), c('3', 'Spray SA', 'equipo')], [c('4', 'Viejo', 'historico')])
    expect(merged.map((item) => [item.id, item.origin])).toEqual([['1', 'mio'], ['3', 'equipo'], ['4', 'historico']])
  })
  it('"Coticé hoy" marca lastQuotedAt en la ficha existente sin tocar lo demás', () => {
    const clients = [{ id: '1', company: 'Spray SA', notes: 'mía', sales: 3 }]
    const result = applyQuotedMark(clients, { id: '1', company: 'Spray SA' }, 'T', () => 'nuevo')
    expect(result.added).toBe(false)
    expect(result.clients).toEqual([{ id: '1', company: 'Spray SA', notes: 'mía', sales: 3, lastQuotedAt: 'T', updatedAt: 'T' }])
  })
  it('si la empresa no está, la agrega como nueva (con el id del directorio si vino de ahí)', () => {
    const fromTeam = applyQuotedMark([], { id: 'dir-9', company: 'Techos Norte', origin: 'equipo' }, 'T', () => 'nuevo')
    expect(fromTeam.clients[0]).toMatchObject({ id: 'dir-9', company: 'Techos Norte', lastQuotedAt: 'T', source: 'Directorio del equipo', sourceType: 'A confirmar' })
    const typed = applyQuotedMark([], { company: 'Cliente Nuevo', phone: '11' }, 'T', () => 'nuevo')
    expect(typed.clients[0]).toMatchObject({ id: 'nuevo', company: 'Cliente Nuevo', phone: '11', source: 'Cotizador' })
    expect(applyQuotedMark([], { company: '  ' }, 'T', () => 'x').added).toBe(false)
  })
})
