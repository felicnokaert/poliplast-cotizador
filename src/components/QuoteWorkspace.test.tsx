import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { QuoteWorkspace } from './QuoteWorkspace'
import * as commercialRulesLib from '../lib/commercialRules'
import * as catalogLib from '../lib/catalog'
import * as clientsLib from '../lib/clients'
import * as exchangeLib from '../lib/exchange'
import type { CommercialRule } from '../types/commercialRules'
import type { ProductWithVariants, VariantWithPricing } from '../types/catalog'

const almohadasRule: CommercialRule = {
  id: 'rule-almohadas',
  scope_type: 'family',
  family: 'Almohadas',
  variant_id: null,
  quantity_comparator: 'gt',
  min_quantity: 200,
  net_amount: 5.15,
  vat_rate: 0.21,
  gross_amount: 6.2315,
  currency: 'USD',
  unit: 'unidad',
  valid_from: '2026-01-01',
  valid_until: null,
  source: 'Confirmado por Felipe Cnokaert, 12/09/2026',
  status: 'confirmado',
  override_reason: '',
  responsible_user_id: null,
  responsible_email: 'felipe@grupopoliplast.com.ar',
  supersedes_rule_id: null,
  notes: '',
}

const almohadaVariant: VariantWithPricing = {
  id: 'v-almohada', product_id: 'p-almohada', sku: 'ALM-1', name: 'Almohada clásica', unit: 'u',
  attributes: {}, active: true, hasTechnicalDoc: false,
  prices: [{
    id: 'vp1', price_list_id: 'pl1', variant_id: 'v-almohada', min_quantity: 1, max_quantity: null,
    amount: 4, status: 'confirmado',
    price_list: { id: 'pl1', name: 'Lista general', brand: 'Grupo Poliplast', currency: 'USD', vat_rate: 0.21, valid_from: '2026-01-01', valid_until: null, status: 'vigente' },
  }],
}

const almohadaProduct: ProductWithVariants = {
  id: 'p-almohada', canonical_key: 'p-almohada', name: 'Almohada clásica', brand: 'Grupo Poliplast',
  family: 'Almohadas', subfamily: '', status: 'vigente', source: 'test', source_updated_at: null,
  variants: [almohadaVariant],
}

function mockCommonLoaders() {
  vi.spyOn(clientsLib, 'loadCommercialClients').mockResolvedValue([])
  vi.spyOn(exchangeLib, 'fetchOfficialDollar').mockRejectedValue(new Error('sin red'))
  vi.spyOn(catalogLib, 'loadCatalog').mockResolvedValue({
    products: [almohadaProduct],
    families: ['Almohadas'],
    brands: ['Grupo Poliplast'],
  })
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  localStorage.clear()
})

describe('QuoteWorkspace — reglas comerciales conectadas', () => {
  it('avisa sin bloquear cuando la cantidad supera el stock aprobado', async () => {
    mockCommonLoaders()
    vi.spyOn(commercialRulesLib, 'loadCommercialRules').mockResolvedValue([])
    almohadaVariant.approvedStock = { quantity: 5, unit: 'u', approvedAt: '2026-09-12T00:00:00Z' }
    render(<QuoteWorkspace userEmail="marketing@grupopoliplast.com.ar" userId="u1" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Agregar' }))
    fireEvent.change(await screen.findByLabelText('Cantidad'), { target: { value: '6' } })
    expect(await screen.findByText(/Cantidad supera el último saldo aprobado/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Vista previa / PDF' })).toBeEnabled()
    delete almohadaVariant.approvedStock
  })

  it('permite registrar el estado comercial de la cotización', async () => {
    mockCommonLoaders()
    vi.spyOn(commercialRulesLib, 'loadCommercialRules').mockResolvedValue([])
    render(<QuoteWorkspace userEmail="marketing@grupopoliplast.com.ar" userId="u1" />)
    const status = await screen.findByLabelText('Estado de la cotización')
    fireEvent.change(status, { target: { value: 'enviada' } })
    expect(status).toHaveValue('enviada')
  })

  it('protege el trabajo actual y lo recupera después de recargar', async () => {
    mockCommonLoaders()
    vi.spyOn(commercialRulesLib, 'loadCommercialRules').mockResolvedValue([])

    const first = render(<QuoteWorkspace userEmail="marketing@grupopoliplast.com.ar" userId="u1" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Agregar' }))
    await waitFor(() => expect(screen.getByText(/Borrador protegido automáticamente/)).toBeInTheDocument())
    first.unmount()

    render(<QuoteWorkspace userEmail="marketing@grupopoliplast.com.ar" userId="u1" />)
    expect(await screen.findByLabelText('Cantidad')).toHaveValue(1)
  })

  it('con reglas cargadas, agregar 201 almohadas muestra la etiqueta de la regla aplicada', async () => {
    mockCommonLoaders()
    vi.spyOn(commercialRulesLib, 'loadCommercialRules').mockResolvedValue([almohadasRule])

    render(<QuoteWorkspace userEmail="marketing@grupopoliplast.com.ar" userId="u1" />)

    const addButton = await screen.findByRole('button', { name: 'Agregar' })
    fireEvent.click(addButton)

    const quantityInput = await screen.findByLabelText('Cantidad')
    fireEvent.change(quantityInput, { target: { value: '201' } })

    await waitFor(() => {
      expect(screen.getByText('Mayorista Almohadas · más de 200 unidades · USD 6,2315 final con IVA incluido')).toBeInTheDocument()
    })
  })

  it('con exactamente 200 unidades NO muestra la etiqueta de regla (precio normal)', async () => {
    mockCommonLoaders()
    vi.spyOn(commercialRulesLib, 'loadCommercialRules').mockResolvedValue([almohadasRule])

    render(<QuoteWorkspace userEmail="marketing@grupopoliplast.com.ar" userId="u1" />)

    const addButton = await screen.findByRole('button', { name: 'Agregar' })
    fireEvent.click(addButton)

    const quantityInput = await screen.findByLabelText('Cantidad')
    fireEvent.change(quantityInput, { target: { value: '200' } })

    await waitFor(() => expect(quantityInput).toHaveValue(200))
    expect(screen.queryByText(/Mayorista Almohadas/)).not.toBeInTheDocument()
  })

  it('si falla la carga de reglas, mantiene el precio normal y avisa "Reglas comerciales no disponibles"', async () => {
    mockCommonLoaders()
    vi.spyOn(commercialRulesLib, 'loadCommercialRules').mockRejectedValue(new Error('Supabase caído'))

    render(<QuoteWorkspace userEmail="marketing@grupopoliplast.com.ar" userId="u1" />)

    const addButton = await screen.findByRole('button', { name: 'Agregar' })
    fireEvent.click(addButton)

    const quantityInput = await screen.findByLabelText('Cantidad')
    fireEvent.change(quantityInput, { target: { value: '201' } })

    await waitFor(() => {
      expect(screen.getByText('Reglas comerciales no disponibles')).toBeInTheDocument()
    })
    expect(screen.queryByText(/Mayorista Almohadas/)).not.toBeInTheDocument()
  })
})
