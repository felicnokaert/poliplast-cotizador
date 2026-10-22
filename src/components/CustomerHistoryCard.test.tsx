import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as historyLib from '../lib/customerHistory'
import { CustomerHistoryCard } from './CustomerHistoryCard'

vi.mock('../lib/supabase', () => ({ supabase: { from: vi.fn() } }))

afterEach(() => { cleanup(); vi.restoreAllMocks() })

describe('CustomerHistoryCard', () => {
  it('no muestra nada con un nombre corto', () => {
    const { container } = render(<CustomerHistoryCard names={['ab']} quotes={[]} currentNumber="" />)
    expect(container).toBeEmptyDOMElement()
  })
  it('muestra la facturación de Contabilium y avisa cuando dejó de comprar', async () => {
    vi.spyOn(historyLib, 'loadCustomerComprobantes').mockResolvedValue([
      { company: 'COMARG', tipo: 'FCA', fecha: '2025-01-10', cliente: 'Carrocerías Norte S.A.', total: '100.000,00' },
      { company: 'COMARG', tipo: 'FCA', fecha: '2025-03-10', cliente: 'Carrocerías Norte S.A.', total: '120.000,00' },
    ])
    render(<CustomerHistoryCard names={['Carrocerías Norte']} quotes={[]} currentNumber="" />)
    expect(await screen.findByText('Inactivo', {}, { timeout: 3000 })).toBeInTheDocument()
    expect(screen.getByText(/No compra hace \d+ días/)).toBeInTheDocument()
    expect(screen.getByText('Última compra')).toBeInTheDocument()
  })
  it('si no hay facturas con ese nombre lo dice y no inventa datos', async () => {
    vi.spyOn(historyLib, 'loadCustomerComprobantes').mockResolvedValue([])
    render(<CustomerHistoryCard names={['Cliente Nuevo SRL']} quotes={[]} currentNumber="" />)
    expect(await screen.findByText(/No encontré facturas con ese nombre/, {}, { timeout: 3000 })).toBeInTheDocument()
  })
})
