import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { QuoteWorkspace } from './QuoteWorkspace'
import * as commercialRulesLib from '../lib/commercialRules'
import * as catalogLib from '../lib/catalog'
import * as clientsLib from '../lib/clients'
import * as exchangeLib from '../lib/exchange'
import * as sharedQuotesLib from '../lib/sharedQuotes'
import * as paymentPoliciesLib from '../lib/paymentPolicies'
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
    // La tarjeta "Para seguir hoy" también nombra a los clientes con enviadas sin respuesta: se mira solo la lista del historial.
    const list = within(document.querySelector('.history-list') as HTMLElement)
    expect(list.getByText('Cliente Alfa')).toBeInTheDocument()
    expect(list.queryByText('Cliente Beta')).not.toBeInTheDocument()
  })

  it('protege la cotización antes de abrir WhatsApp', async () => {
    mockCommonLoaders()
    vi.spyOn(commercialRulesLib, 'loadCommercialRules').mockResolvedValue([])
    vi.spyOn(clientsLib, 'loadCommercialClients').mockResolvedValue([{ id: 'c1', company: 'Cliente Alfa', legalName: 'Cliente Alfa SA', cuit: '', contact: '', phone: '5491155551234', phones: ['5491155551234'], email: '', origin: 'mio' }])
    const saveShared = vi.spyOn(sharedQuotesLib, 'saveSharedQuote').mockResolvedValue()
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    render(<QuoteWorkspace userEmail="marketing@grupopoliplast.com.ar" userId="u1" />)
    openCatalog()
    fireEvent.click(await screen.findByRole('button', { name: 'Agregar' }))
    openActiveQuote()
    const markQuoted = vi.spyOn(clientsLib, 'markQuotedInCrm').mockResolvedValue({ added: false })
    fireEvent.change(await screen.findByPlaceholderText(/Escribí para buscar entre 1 empresas del CRM/), { target: { value: 'Cliente Alfa' } })
    expect(await screen.findByText(/al guardar se marca "Coticé hoy"/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'WhatsApp' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Continuar a WhatsApp' }))
    await waitFor(() => expect(saveShared).toHaveBeenCalled())
    // Cotizar marca "Coticé hoy" en la ficha del CRM (nunca una venta).
    await waitFor(() => expect(markQuoted).toHaveBeenCalledWith('u1', 'marketing@grupopoliplast.com.ar', expect.objectContaining({ id: 'c1', company: 'Cliente Alfa' })))
    expect(open).toHaveBeenCalledWith(expect.stringContaining('wa.me/5491155551234'), '_blank', 'noopener,noreferrer')
    // Mandarla por WhatsApp la deja como "Enviada" y eso arma el seguimiento en el CRM.
    expect(saveShared).toHaveBeenCalledWith(expect.objectContaining({ meta: expect.objectContaining({ status: 'enviada' }) }), 'u1', expect.anything())
    expect(screen.getByLabelText('Estado')).toHaveValue('enviada')
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

describe('QuoteWorkspace — llegada desde el CRM', () => {
  it('con ?cliente= abre una cotización con esa empresa y completa su contacto', async () => {
    mockCommonLoaders()
    vi.spyOn(commercialRulesLib, 'loadCommercialRules').mockResolvedValue([])
    vi.spyOn(clientsLib, 'loadCommercialClients').mockResolvedValue([{ id: 'c1', company: 'Cliente Alfa', legalName: '', cuit: '', contact: 'Ana', phone: '5491155551234', phones: ['5491155551234'], email: 'ana@alfa.com', origin: 'mio' }])
    window.history.replaceState(null, '', '/?cliente=Cliente%20Alfa')
    render(<QuoteWorkspace userEmail="marketing@grupopoliplast.com.ar" userId="u1" />)
    expect(await screen.findByDisplayValue('Cliente Alfa')).toBeInTheDocument()
    expect(await screen.findByDisplayValue('Ana')).toBeInTheDocument()
    expect(window.location.search).toBe('')
  })
})

describe('QuoteWorkspace — link viejo del CRM', () => {
  it('también entiende ?empresa= y ?telefono=', async () => {
    mockCommonLoaders()
    vi.spyOn(commercialRulesLib, 'loadCommercialRules').mockResolvedValue([])
    vi.spyOn(clientsLib, 'loadCommercialClients').mockResolvedValue([])
    window.history.replaceState(null, '', '/?empresa=Beta%20SRL&telefono=5491100000000')
    render(<QuoteWorkspace userEmail="marketing@grupopoliplast.com.ar" userId="u1" />)
    expect(await screen.findByDisplayValue('Beta SRL')).toBeInTheDocument()
    expect(await screen.findByDisplayValue('5491100000000')).toBeInTheDocument()
  })

  it('sugiere lo que se suele cotizar junto, según el historial, y lo agrega con un toque', async () => {
    const fundaVariant: VariantWithPricing = { ...almohadaVariant, id: 'v-funda', product_id: 'p-funda', sku: 'FUN-1', name: 'Funda', prices: almohadaVariant.prices.map((price) => ({ ...price, id: 'vp2', variant_id: 'v-funda' })) }
    const fundaProduct: ProductWithVariants = { ...almohadaProduct, id: 'p-funda', canonical_key: 'p-funda', name: 'Funda térmica', variants: [fundaVariant] }
    vi.spyOn(clientsLib, 'loadCommercialClients').mockResolvedValue([])
    vi.spyOn(exchangeLib, 'fetchOfficialDollar').mockRejectedValue(new Error('sin red'))
    vi.spyOn(commercialRulesLib, 'loadCommercialRules').mockResolvedValue([])
    vi.spyOn(catalogLib, 'loadCatalog').mockResolvedValue({ products: [almohadaProduct, fundaProduct], families: ['Almohadas'], brands: ['Grupo Poliplast'] })
    const meta = (number: string) => ({ number, client: 'X', contact: '', phone: '', email: '', notes: '', paymentMethod: 'transferencia', priceMode: 'automatico', validDays: 7, discountPercent: 0, surchargePercent: 0, exchangeRate: 1, outputCurrency: 'USD', status: 'aceptada', createdAt: '2026-09-14T10:00:00Z' })
    const pair = (number: string) => ({ meta: meta(number), lines: [{ id: 'a', productId: 'p-almohada', productName: 'Almohada clásica', brand: 'Grupo Poliplast', family: 'Almohadas', variant: almohadaVariant, quantity: 1 }, { id: 'b', productId: 'p-funda', productName: 'Funda térmica', brand: 'Grupo Poliplast', family: 'Almohadas', variant: fundaVariant, quantity: 1 }], updatedAt: '2026-09-14T10:00:00Z' })
    localStorage.setItem('poliplast-cotizador-quotes-v1', JSON.stringify([pair('0001'), pair('0002')]))
    localStorage.setItem('poliplast-cotizador-working-draft-v1', JSON.stringify({ meta: { ...meta(''), status: 'borrador' }, lines: [pair('x').lines[0]], updatedAt: '2026-10-20T10:00:00Z' }))
    render(<QuoteWorkspace userEmail="marketing@grupopoliplast.com.ar" userId="u1" />)
    fireEvent.click(screen.getByRole('button', { name: /Cotización activa/ }))
    const box = await screen.findByRole('complementary', { name: 'Se suele cotizar junto' })
    expect(within(box).getByText('Funda térmica')).toBeInTheDocument()
    fireEvent.click(within(box).getByRole('button', { name: '+ Agregar' }))
    await waitFor(() => expect(screen.queryByRole('complementary', { name: 'Se suele cotizar junto' })).not.toBeInTheDocument())
  })

  it('guarda la cotización como plantilla y la vuelve a cargar con los precios de hoy', async () => {
    mockCommonLoaders()
    vi.spyOn(commercialRulesLib, 'loadCommercialRules').mockResolvedValue([])
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    localStorage.setItem('poliplast-cotizador-templates-v1', JSON.stringify([{ id: 't1', name: 'Kit almohadas', createdAt: '2026-10-01T10:00:00Z', items: [{ productId: 'p-almohada', variantId: 'v-almohada', name: 'Almohada clásica', sku: 'ALM-1', quantity: 3 }, { productId: 'p-viejo', variantId: 'v-viejo', name: 'Producto discontinuado', sku: 'OLD-1', quantity: 1 }] }]))
    render(<QuoteWorkspace userEmail="marketing@grupopoliplast.com.ar" userId="u1" />)
    fireEvent.click(screen.getByRole('button', { name: /Cotización activa/ }))
    const use = await screen.findByRole('button', { name: /^Kit almohadas/ })
    await waitFor(() => expect(use).not.toBeDisabled())
    fireEvent.click(use)
    expect(await screen.findByText(/se agregaron 1; 1 ya no están en el catálogo \(OLD-1\)/)).toBeInTheDocument()
    expect(screen.getAllByText('Almohada clásica').length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('button', { name: /Guardar esta cotización como plantilla/ }))
    fireEvent.change(screen.getByLabelText('Nombre de la plantilla'), { target: { value: 'Otra' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(JSON.parse(localStorage.getItem('poliplast-cotizador-templates-v1') || '[]').map((item: { name: string }) => item.name)).toEqual(['Otra', 'Kit almohadas'])
  })

  it('avisa los precios que cambiaron desde que se armó la cotización y los actualiza con un toque', async () => {
    mockCommonLoaders()
    vi.spyOn(commercialRulesLib, 'loadCommercialRules').mockResolvedValue([])
    const oldVariant: VariantWithPricing = { ...almohadaVariant, prices: almohadaVariant.prices.map((price) => ({ ...price, amount: 3 })) }
    const meta = { number: '0009', client: 'Cliente Alfa', contact: '', phone: '', email: '', notes: '', paymentMethod: 'transferencia', priceMode: 'automatico', validDays: 7, discountPercent: 0, surchargePercent: 0, exchangeRate: 1, outputCurrency: 'USD', status: 'enviada', createdAt: '2026-09-14T10:00:00Z' }
    const saved = { meta, lines: [{ id: 'a', productId: 'p-almohada', productName: 'Almohada clásica', brand: 'Grupo Poliplast', family: 'Almohadas', variant: oldVariant, quantity: 1 }], updatedAt: '2026-09-14T10:00:00Z' }
    localStorage.setItem('poliplast-cotizador-quotes-v1', JSON.stringify([saved]))
    localStorage.setItem('poliplast-cotizador-working-draft-v1', JSON.stringify({ meta, lines: saved.lines, updatedAt: '2026-10-20T10:00:00Z' }))
    render(<QuoteWorkspace userEmail="marketing@grupopoliplast.com.ar" userId="u1" />)
    expect(await screen.findByText(/Precios cambiaron: 1 subió/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Cotización activa/ }))
    const alert = await screen.findByRole('alert', { name: 'Alertas de precio' })
    expect(within(alert).getByText(/US\$\s?3,00 → US\$\s?4,00/)).toBeInTheDocument()
    fireEvent.click(within(alert).getByRole('button', { name: 'Actualizar precios de hoy' }))
    await waitFor(() => expect(screen.queryByRole('alert', { name: 'Alertas de precio' })).not.toBeInTheDocument())
  })

  it('la vista previa (PDF) muestra la foto de cada producto', async () => {
    mockCommonLoaders()
    vi.spyOn(commercialRulesLib, 'loadCommercialRules').mockResolvedValue([])
    const meta = { number: '', client: 'Cliente Alfa', contact: '', phone: '', email: '', notes: '', paymentMethod: 'transferencia', priceMode: 'automatico', validDays: 7, discountPercent: 0, surchargePercent: 0, exchangeRate: 1, outputCurrency: 'USD', status: 'borrador', createdAt: '2026-10-20T10:00:00Z' }
    const line = { id: 'a', productId: 'p-almohada', productName: 'Almohada clásica', brand: 'Grupo Poliplast', family: 'Almohadas', variant: almohadaVariant, quantity: 1, photoPath: 'https://cdn.shopify.com/almohada.png' }
    localStorage.setItem('poliplast-cotizador-working-draft-v1', JSON.stringify({ meta, lines: [line], updatedAt: '2026-10-20T10:00:00Z' }))
    const { baseElement } = render(<QuoteWorkspace userEmail="marketing@grupopoliplast.com.ar" userId="u1" />)
    fireEvent.click(screen.getByRole('button', { name: /Cotización activa/ }))
    const preview = await screen.findByRole('button', { name: 'Vista previa' })
    await waitFor(() => expect(preview).not.toBeDisabled())
    fireEvent.click(preview)
    const dialog = await screen.findByRole('dialog', { name: /Vista previa/ })
    expect(dialog.querySelector('img.preview-photo')?.getAttribute('src')).toBe('https://cdn.shopify.com/almohada.png')
    expect(baseElement).toBeTruthy()
  })

  it('repite una cotización anterior del mismo cliente con los precios de hoy', async () => {
    mockCommonLoaders()
    vi.spyOn(commercialRulesLib, 'loadCommercialRules').mockResolvedValue([])
    const meta = (number: string, status: string) => ({ number, client: 'Cliente Alfa', contact: '', phone: '', email: '', notes: '', paymentMethod: 'transferencia', priceMode: 'automatico', validDays: 7, discountPercent: 0, surchargePercent: 0, exchangeRate: 1, outputCurrency: 'USD', status, createdAt: '2026-09-14T10:00:00Z' })
    const old = { meta: meta('0001', 'enviada'), lines: [{ id: 'a', productId: 'p-almohada', productName: 'Almohada clásica', brand: 'Grupo Poliplast', family: 'Almohadas', variant: almohadaVariant, quantity: 3 }, { id: 'z', productId: 'p-viejo', productName: 'Producto discontinuado', brand: 'X', family: 'F', variant: { ...almohadaVariant, id: 'v-viejo', sku: 'OLD-1' }, quantity: 1 }], updatedAt: '2026-09-14T10:00:00Z' }
    localStorage.setItem('poliplast-cotizador-quotes-v1', JSON.stringify([old]))
    localStorage.setItem('poliplast-cotizador-working-draft-v1', JSON.stringify({ meta: meta('', 'borrador'), lines: [], updatedAt: '2026-10-20T10:00:00Z' }))
    render(<QuoteWorkspace userEmail="marketing@grupopoliplast.com.ar" userId="u1" />)
    fireEvent.click(screen.getByRole('button', { name: /Cotización activa/ }))
    const repeat = await screen.findByRole('button', { name: /N° 0001/ })
    await waitFor(() => expect(repeat).not.toBeDisabled())
    fireEvent.click(repeat)
    expect(await screen.findByText(/Cotización 0001: se cargaron 1; 1 ya no están en el catálogo \(OLD-1\)/)).toBeInTheDocument()
    expect(screen.getAllByText('Almohada clásica').length).toBeGreaterThan(0)
  })

  it('si se toca "Solo guardar" y enseguida WhatsApp, la cotización igual queda Enviada con un solo número', async () => {
    mockCommonLoaders()
    vi.spyOn(commercialRulesLib, 'loadCommercialRules').mockResolvedValue([])
    vi.spyOn(clientsLib, 'loadCommercialClients').mockResolvedValue([{ id: 'c1', company: 'Cliente Alfa', legalName: '', cuit: '', contact: '', phone: '5491155551234', phones: ['5491155551234'], email: '', origin: 'mio' }])
    let release: (value: string) => void = () => {}
    const reserve = vi.spyOn(paymentPoliciesLib, 'reserveQuoteNumber').mockImplementation(() => new Promise<string>((resolve) => { release = resolve }))
    const saveShared = vi.spyOn(sharedQuotesLib, 'saveSharedQuote').mockResolvedValue()
    vi.spyOn(window, 'open').mockImplementation(() => null)
    render(<QuoteWorkspace userEmail="marketing@grupopoliplast.com.ar" userId="u1" />)
    openCatalog()
    fireEvent.click(await screen.findByRole('button', { name: 'Agregar' }))
    openActiveQuote()
    fireEvent.change(await screen.findByPlaceholderText(/Escribí para buscar entre 1 empresas del CRM/), { target: { value: 'Cliente Alfa' } })
    fireEvent.click(screen.getByRole('button', { name: 'Solo guardar' }))
    fireEvent.click(screen.getByRole('button', { name: 'WhatsApp' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Continuar a WhatsApp' }))
    release('0042')
    await waitFor(() => expect(saveShared).toHaveBeenCalledTimes(2))
    expect(reserve).toHaveBeenCalledTimes(1)
    const sent = saveShared.mock.calls.map((call) => call[0])
    expect(sent.every((quote) => quote.meta.number === '0042')).toBe(true)
    expect(sent.at(-1)?.meta.status).toBe('enviada')
  })
})
