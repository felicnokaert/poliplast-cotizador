import { supabase } from './supabase'

export interface CommercialClient {
  id: string
  company: string
  legalName: string
  cuit: string
  contact: string
  phone: string
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
    const company = String(client.company ?? client.legalName ?? '').trim()
    if (!company) return []
    return [{
      id: String(client.id ?? company), company, legalName: String(client.legalName ?? ''), cuit: String(client.cuit ?? ''),
      contact: String(contact.name ?? client.contact ?? ''), phone: String(contact.phone ?? contact.whatsappId ?? client.phone ?? ''), email: String(contact.email ?? client.email ?? ''),
    }]
  }).sort((a, b) => a.company.localeCompare(b.company, 'es-AR'))
}

export async function loadCommercialClients(userId: string): Promise<CommercialClient[]> {
  const { data, error } = await supabase.from('workspace_states').select('data').eq('workspace_key', userId).maybeSingle()
  if (error) throw error
  return extractCommercialClients(data?.data)
}
