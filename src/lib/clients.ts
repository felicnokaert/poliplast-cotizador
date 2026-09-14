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

export async function loadCommercialClients(_userId: string): Promise<CommercialClient[]> {
  const { data, error } = await supabase.from('workspace_states').select('data').eq('workspace_key', 'grupo-poliplast').maybeSingle()
  if (error) throw error
  const clients = extractCommercialClients(data?.data)
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
