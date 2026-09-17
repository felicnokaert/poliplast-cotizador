import { supabase } from './supabase'

export interface PaymentPolicy {
  id: string
  name: string
  customerText: string
  discountPercent: number
  surchargePercent: number
  active: boolean
  sortOrder: number
}

export const DEFAULT_PAYMENT_POLICIES: PaymentPolicy[] = [
  { id: 'transferencia', name: 'Transferencia', customerText: 'Pago mediante transferencia bancaria.', discountPercent: 0, surchargePercent: 0, active: true, sortOrder: 10 },
  { id: 'contado', name: 'Contado', customerText: 'Pago contado.', discountPercent: 0, surchargePercent: 0, active: true, sortOrder: 20 },
  { id: 'cuenta_corriente', name: 'Cuenta corriente', customerText: 'Sujeto a cuenta corriente aprobada.', discountPercent: 0, surchargePercent: 0, active: true, sortOrder: 30 },
  { id: 'cheque', name: 'Cheque', customerText: 'Pago mediante cheque a plazo acordado.', discountPercent: 0, surchargePercent: 0, active: true, sortOrder: 35 },
  { id: 'tarjeta', name: 'Tarjeta / cuotas', customerText: 'Recargo o financiación según condición confirmada.', discountPercent: 0, surchargePercent: 0, active: true, sortOrder: 40 },
]

export async function loadPaymentPolicies(): Promise<PaymentPolicy[]> {
  const { data, error } = await supabase.from('payment_policies').select('*').eq('active', true).order('sort_order')
  if (error) return DEFAULT_PAYMENT_POLICIES
  return (data ?? []).map((row) => ({ id: row.id, name: row.name, customerText: row.customer_text, discountPercent: Number(row.discount_percent), surchargePercent: Number(row.surcharge_percent), active: row.active, sortOrder: row.sort_order }))
}

export async function savePaymentPolicy(policy: PaymentPolicy): Promise<void> {
  const { error } = await supabase.from('payment_policies').upsert({ id: policy.id, name: policy.name, customer_text: policy.customerText, discount_percent: policy.discountPercent, surcharge_percent: policy.surchargePercent, active: policy.active, sort_order: policy.sortOrder })
  if (error) throw error
}

export async function reserveQuoteNumber(existingNumbers: string[]): Promise<string> {
  try {
    const { data, error } = await supabase.rpc('reserve_sales_quote_number')
    if (!error && typeof data === 'string') return data
  } catch {
    // sin conexión o RPC no disponible: seguimos con el fallback local
  }
  const max = existingNumbers.reduce((value, item) => /^\d+$/.test(item) ? Math.max(value, Number(item)) : value, 0)
  return String(max + 1).padStart(4, '0')
}
