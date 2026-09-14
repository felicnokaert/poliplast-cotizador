import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { QuoteWorkspace } from './QuoteWorkspace'
import * as commercialRulesLib from '../lib/commercialRules'
import * as catalogLib from '../lib/catalog'
import * as clientsLib from '../lib/clients'
import * as exchangeLib from '../lib/exchange'
import * as sharedQuotesLib from '../lib/sharedQuotes'
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
  aggregate_by_family: false,
  aggregate_by_pack_group: false,
  pack_group: null,
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

function openActiveQuote() {
  fireEvent.click(screen.getByRole('button', { name: /^Ver cotización \(/ }))
}

function openCatalog() { fireEvent.click(screen.getByRole('button', { name: /Catálogo/ })) }

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  localStorage.clear()
})

describe('QuoteWorkspace — reglas comerciales conectadas', () => {
  it('busca el historial por cliente, número, producto o SKU', async () => {
    mockCommonLoaders()
    vi.spyOn(commercialRulesLib, 'loadCommercialRules').mockResolvedValue([])
    localStorage.setItem('poliplast-cotizador-quotes-v1', JSON.stringify([
      { meta: { number: '0001', client: 'Cliente Alfa', contact: '', phone: '', email: '', notes: '', paymentMethod: 'transferencia', priceMode: 'automatico', validDays: 7, discountPercent: 0, surchargePercent: 0, exchangeRate: 1, outputCurrency: 'USD', status: 'borrador', createdAt: '2026-09-14T10:00:00Z' }, lines: [{ id: 'l1', productId: 'p-almohada', productName: 'Almohada clásica', brand: 'Grupo Poliplast', family: 'Almohadas', variant: almohadaVariant, quantity: 1 }], updatedAt: '2026-09-14T10:00:00Z' },
      { meta: { number: '0002', client: 'Cliente Beta', contact: '', phone: '', email: '', notes: '', paymentMethod: 'transferencia', priceMode: 'automatico', validDays: 7, discountPercent: 0, surchargePercent: 0, exchangeRate: 1, outputCurrency: 'USD', status: 'enviada', createdAt: '2026-09-14T11:00:00Z' }, lines: [], updatedAt: '2026-09-14T11:00:00Z' },
    ]))
    render(<QuoteWorkspace userEmail="marketing@grupopoliplast.com.ar" userId="u1" />)
    const search = screen.getByRole('searchbox', { name: 'Buscar cotizaciones' })
    fireEvent.change(search, { target: { value: 'ALM-1' } })
    expect(screen.getByText('Cliente Alfa')).toBeInTheDocument()
    expect(screen.queryByText('Cliente Beta')).not.toBeInTheDocument()
  })

  it('protege la cotización antes de abrir WhatsApp', async () => {
    mockCommonLoaders()
    vi.spyOn(commercialRulesLib, 'loadCommercialRules').mockResolvedValue([])
    vi.spyOn(clientsLib, 'loadCommercialClients').mockResolvedValue([{ id: 'c1', company: 'Cliente Alfa', legalName: 'Cliente Alfa SA', cuit: '', contact: '', phone: '5491155551234', phones: ['5491155551234'], email: '' }])
    const saveShared = vi.spyOn(sharedQuotesLib, 'saveSharedQuote').mockResolvedValue()
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    render(<QuoteWorkspace userEmail="marketing@grupopoliplast.com.ar" userId="u1" />)
    openCatalog()
    fireEvent.click(await screen.findByRole('button', { name: 'Agregar' }))
    openActiveQuote()
    fireEvent.click(screen.getByRole('button', { name: /Agregar datos/ }))
    fireEvent.change(await screen.findByLabelText('Elegir del CRM'), { target: { value: 'c1' } })
    fireEvent.click(screen.getByRole('button', { name: 'WhatsApp' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Continuar a WhatsApp' }))
    await waitFor(() => expect(saveShared).toHaveBeenCalled())
    expect(open).toHaveBeenCalledWith(expect.stringContaining('wa.me/5491155551234'), '_blank', 'noopener,noreferrer')
  })

  it('en una cotización no despliega el catálogo hasta escribir tres caracteres', async () => {
    mockCommonLoaders()
    vi.spyOn(commercialRulesLib, 'loadCommercialRules').mockResolvedValue([])
    render(<QuoteWorkspace userEmail="marketing@grupopoliplast.com.ar" userId="u1" />)
    fireEvent.click(screen.getByRole('button', { name: '+ Nueva cotización' }))
    expect(await screen.findByText(/Escribí al menos 3 caracteres/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Agregar' })).not.toBeInTheDocument()
    fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar productos' }), { target: { value: 'alm' } })
    expect(await screen.findByRole('button', { name: 'Agregar' })).toBeInTheDocument()
  })

  it('avisa sin bloquear cuando la cantidad supera el stock aprobado', async () => {
    mockCommonLoaders()
    vi.spyOn(commercialRulesLib, 'loadCommercialRules').mockResolvedValue([])
    almohadaVariant.approvedStock = { quantity: 5, unit: 'u', approvedAt: '2026-09-12T00:00:00Z' }
    render(<QuoteWorkspace userEmail="marketing@grupopoliplast.com.ar" userId="u1" />)
    openCatalog()
    fireEvent.click(await screen.findByRole('button', { name: 'Agregar' }))
    openActiveQuote()
    fireEvent.change(await screen.findByLabelText('Cantidad'), { target: { value: '6' } })
    expect(await screen.findByText(/Cantidad supera el último saldo aprobado/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Vista previa' })).toBeEnabled()
    delete almohadaVariant.approvedStock
  })

  it('permite registrar el estado comercial de la cotización', async () => {
    mockCommonLoaders()
    vi.spyOn(commercialRulesLib, 'loadCommercialRules').mockResolvedValue([])
    render(<QuoteWorkspace userEmail="marketing@grupopoliplast.com.ar" userId="u1" />)
    fireEvent.click(screen.getByRole('button', { name: '+ Nueva cotización' }))
    const status = await screen.findByLabelText('Estado')
    fireEvent.change(status, { target: { value: 'enviada' } })
    expect(status).toHaveValue('enviada')
  })

  it('protege el trabajo actual y lo recupera después de recargar', async () => {
    mockCommonLoaders()
    vi.spyOn(commercialRulesLib, 'loadCommercialRules').mockResolvedValue([])

    const first = render(<QuoteWorkspace userEmail="marketing@grupopoliplast.com.ar" userId="u1" />)
    openCatalog()
    fireEvent.click(await screen.findByRole('button', { name: 'Agregar' }))
    openActiveQuote()
    await waitFor(() => expect(screen.getByText(/Borrador protegido automáticamente/)).toBeInTheDocument())
    first.unmount()

    render(<QuoteWorkspace userEmail="marketing@grupopoliplast.com.ar" userId="u1" />)
    fireEvent.click(screen.getByRole('button', { name: /Continuar borrador/ }))
    expect(await screen.findByLabelText('Cantidad')).toHaveValue(1)
  })

  it('con reglas cargadas, agregar 201 almohadas muestra la etiqueta de la regla aplicada', async () => {
    mockCommonLoaders()
    vi.spyOn(commercialRulesLib, 'loadCommercialRules').mockResolvedValue([almohadasRule])

    render(<QuoteWorkspace userEmail="marketing@grupopoliplast.com.ar" userId="u1" />)
    openCatalog()

    const addButton = await screen.findByRole('button', { name: 'Agregar' })
    fireEvent.click(addButton)
    openActiveQuote()

    const quantityInput = await screen.findByLabelText('Cantidad')
    fireEvent.change(quantityInput, { target: { value: '201' } })

    await waitFor(() => {
      expect(screen.getByText(/ALM-1.*Mayorista Almohadas/)).toBeInTheDocument()
      expect(screen.getByText(/201 unidades físicas computadas por familia/)).toBeInTheDocument()
    })
  })

  it('con exactamente 200 unidades NO muestra la etiqueta de regla (precio normal)', async () => {
    mockCommonLoaders()
    vi.spyOn(commercialRulesLib, 'loadCommercialRules').mockResolvedValue([almohadasRule])

    render(<QuoteWorkspace userEmail="marketing@grupopoliplast.com.ar" userId="u1" />)
    openCatalog()

    const addButton = await screen.findByRole('button', { name: 'Agregar' })
    fireEvent.click(addButton)
    openActiveQuote()

    const quantityInput = await screen.findByLabelText('Cantidad')
    fireEvent.change(quantityInput, { target: { value: '200' } })

    await waitFor(() => expect(quantityInput).toHaveValue(200))
    expect(screen.queryByText(/US\$ 6,23 \/ u/)).not.toBeInTheDocument()
  })

  it('si falla la carga de reglas, mantiene el precio normal y avisa "Reglas comerciales no disponibles"', async () => {
    mockCommonLoaders()
    vi.spyOn(commercialRulesLib, 'loadCommercialRules').mockRejectedValue(new Error('Supabase caído'))

    render(<QuoteWorkspace userEmail="marketing@grupopoliplast.com.ar" userId="u1" />)
    openCatalog()

    const addButton = await screen.findByRole('button', { name: 'Agregar' })
    fireEvent.click(addButton)
    openActiveQuote()

    const quantityInput = await screen.findByLabelText('Cantidad')
    fireEvent.change(quantityInput, { target: { value: '201' } })

    await waitFor(() => {
      expect(screen.getByText('Reglas comerciales no disponibles')).toBeInTheDocument()
    })
    expect(screen.queryByText(/Mayorista Almohadas/)).not.toBeInTheDocument()
  })
})
