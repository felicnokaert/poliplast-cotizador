import { supabase } from './supabase'

export interface CommercialClient {
  id: string
  company: string
  legalName: string
  cuit: string
  contact: string
  phone: string
  phones: string[]
  email: string
  // De dónde sale: 'mio' (tu espacio del CRM), 'equipo' (directorio compartido) o 'historico'
  // (el espacio viejo grupo-poliplast). Solo informativo.
  origin?: 'mio' | 'equipo' | 'historico'
}

export const normalizeCompany = (value: string) => value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase('es-AR').replace(/[^a-z0-9]+/g, ' ').trim()

// Une las listas sin repetir empresas (por id o por nombre); la primera lista manda.
export function mergeClientLists(...lists: CommercialClient[][]): CommercialClient[] {
  const ids = new Set<string>()
  const names = new Set<string>()
  const merged: CommercialClient[] = []
  for (const client of lists.flat()) {
    const name = normalizeCompany(client.company)
    if (ids.has(client.id) || names.has(name)) continue
    ids.add(client.id); names.add(name); merged.push(client)
  }
  return merged.sort((a, b) => a.company.localeCompare(b.company, 'es-AR'))
}

function firstContact(client: Record<string, unknown>) {
  const contacts = Array.isArray(client.contacts) ? client.contacts as Array<Record<string, unknown>> : []
  return contacts.find((item) => item.primary) ?? contacts[0] ?? {}
}

export function extractCommercialClients(state: unknown): CommercialClient[] {
  if (!state || typeof state !== 'object') return []
  const clients = (state as { clients?: unknown }).clients
  if (!Array.isArray(clients)) return []
  return clients.flatMap((raw) => {
    if (!raw || typeof raw !== 'object') return []
    const client = raw as Record<string, unknown>
    const contact = firstContact(client)
    const contacts = Array.isArray(client.contacts) ? client.contacts as Array<Record<string, unknown>> : []
    const phones = [...new Set([String(client.phone ?? ''), ...contacts.flatMap((item) => [String(item.phone ?? ''), String(item.whatsappId ?? '')])].map((value) => value.trim()).filter(Boolean))]
    const company = String(client.company ?? client.legalName ?? '').trim()
    if (!company) return []
    return [{
      id: String(client.id ?? company), company, legalName: String(client.legalName ?? ''), cuit: String(client.cuit ?? ''),
      contact: String(contact.name ?? client.contact ?? ''), phone: phones[0] ?? '', phones, email: String(contact.email ?? client.email ?? ''),
    }]
  }).sort((a, b) => a.company.localeCompare(b.company, 'es-AR'))
}

// Clientes para cotizar: primero los del propio espacio del CRM (los mismos que ve cada uno en
// Empresas y contactos), después el directorio del equipo y por último el espacio viejo compartido.
export async function loadCommercialClients(userId: string): Promise<CommercialClient[]> {
  const [own, legacy, directory] = await Promise.all([
    supabase.from('workspace_states').select('data').eq('workspace_key', userId).maybeSingle(),
    supabase.from('workspace_states').select('data').eq('workspace_key', 'grupo-poliplast').maybeSingle(),
    supabase.from('shared_companies').select('data').limit(5000),
  ])
  if (own.error && legacy.error) throw own.error
  const tag = (list: CommercialClient[], origin: CommercialClient['origin']) => list.map((client) => ({ ...client, origin }))
  const clients = mergeClientLists(
    tag(extractCommercialClients(own.data?.data), 'mio'),
    tag(extractCommercialClients({ clients: (directory.data ?? []).map((row) => row.data) }), 'equipo'),
    tag(extractCommercialClients(legacy.data?.data), 'historico'),
  )
  const { data: extras, error: extrasError } = await supabase.from('commercial_client_phones').select('client_key,phone')
  if (extrasError) throw extrasError
  const extraByClient = new Map<string, string[]>()
  for (const row of extras ?? []) extraByClient.set(row.client_key, [...(extraByClient.get(row.client_key) ?? []), row.phone])
  return clients.map((client) => ({ ...client, phones: [...new Set([...client.phones, ...(extraByClient.get(client.id) ?? [])])] }))
}

export async function addCommercialClientPhone(clientKey: string, phone: string, userId: string): Promise<void> {
  const normalized = phone.replace(/\D/g, '')
  if (!clientKey || normalized.length < 8) throw new Error('Número inválido')
  const { error } = await supabase.from('commercial_client_phones').upsert({ client_key: clientKey, phone: normalized, created_by: userId }, { onConflict: 'client_key,phone', ignoreDuplicates: true })
  if (error) throw error
}

type WorkspaceClient = Record<string, unknown> & { id?: string; company?: string }

// "Coticé hoy" en la ficha del CRM (client.lastQuotedAt, el mismo dato que marca el botón de la ficha).
// Una cotización NO es una venta: acá nunca se toca Ventas. Si la empresa no está en el espacio de la
// persona, se agrega (con los datos del directorio si vino de ahí, o con lo cargado en la cotización).
export function applyQuotedMark(clients: WorkspaceClient[], client: Partial<CommercialClient> & { company: string }, stamp: string, newId: () => string) {
  const name = normalizeCompany(client.company)
  if (!name) return { clients, added: false }
  const index = clients.findIndex((item) => (client.id && item.id === client.id) || normalizeCompany(String(item.company ?? '')) === name)
  if (index >= 0) {
    const next = [...clients]
    next[index] = { ...clients[index], lastQuotedAt: stamp, updatedAt: stamp }
    return { clients: next, added: false }
  }
  const record: WorkspaceClient = {
    id: client.id && client.origin === 'equipo' ? client.id : newId(),
    company: client.company.trim(),
    ...(client.legalName ? { legalName: client.legalName } : {}),
    ...(client.cuit ? { cuit: client.cuit } : {}),
    contact: client.contact ?? '', phone: client.phone ?? '', email: client.email ?? '',
    family: 'Sin definir', stage: 'Nuevo', temperature: 'Tibio', pipelineActive: true, sourceType: 'A confirmar',
    source: client.origin === 'equipo' ? 'Directorio del equipo' : 'Cotizador',
    lastQuotedAt: stamp, createdAt: stamp, updatedAt: stamp,
  }
  return { clients: [...clients, record], added: true }
}

export async function markQuotedInCrm(userId: string, email: string, client: Partial<CommercialClient> & { company: string }, stamp = new Date().toISOString()): Promise<{ added: boolean }> {
  // Mismo cuidado que el CRM al guardar: solo escribe si nadie guardó en el medio (updated_at igual).
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data: row, error } = await supabase.from('workspace_states').select('data,updated_at').eq('workspace_key', userId).maybeSingle()
    if (error) throw error
    if (!row) throw new Error('Abrí el CRM una vez con tu cuenta para poder marcar cotizaciones ahí.')
    const state = (row.data ?? {}) as { clients?: WorkspaceClient[] }
    const result = applyQuotedMark(Array.isArray(state.clients) ? state.clients : [], client, stamp, () => crypto.randomUUID())
    const { data: saved, error: saveError } = await supabase
      .from('workspace_states')
      .update({ data: { ...state, clients: result.clients }, updated_by: userId, updated_by_email: email, updated_at: new Date().toISOString() })
      .eq('workspace_key', userId)
      .eq('updated_at', row.updated_at)
      .select('updated_at')
    if (saveError) throw saveError
    if (saved && saved.length) return { added: result.added }
  }
  throw new Error('El CRM se estaba guardando; probá de nuevo.')
}
