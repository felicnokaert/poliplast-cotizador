-- Normaliza las reglas comerciales históricas a la moneda única del cotizador.
-- El valor original queda preservado para auditoría.
create table if not exists public.commercial_rule_currency_conversions (
  id uuid primary key default gen_random_uuid(),
  rule_id uuid not null references public.commercial_rules(id) on delete restrict,
  from_currency text not null,
  to_currency text not null,
  exchange_rate numeric not null check (exchange_rate > 0),
  original_net_amount numeric not null,
  original_gross_amount numeric not null,
  converted_net_amount numeric not null,
  converted_gross_amount numeric not null,
  converted_at timestamptz not null default now(),
  converted_by_email text not null,
  unique (rule_id, from_currency, to_currency, exchange_rate)
);

alter table public.commercial_rule_currency_conversions enable row level security;
create policy "Admin lee conversiones comerciales"
  on public.commercial_rule_currency_conversions for select to authenticated
  using (public.is_poliplast_crm_admin());
grant select on public.commercial_rule_currency_conversions to authenticated;

insert into public.commercial_rule_currency_conversions (
  rule_id, from_currency, to_currency, exchange_rate,
  original_net_amount, original_gross_amount,
  converted_net_amount, converted_gross_amount, converted_by_email
)
select
  id, 'ARS', 'USD', 1530,
  net_amount, gross_amount,
  round(net_amount / 1530, 6), round(gross_amount / 1530, 6),
  'felipe@grupopoliplast.com.ar'
from public.commercial_rules
where status = 'confirmado' and currency = 'ARS'
on conflict (rule_id, from_currency, to_currency, exchange_rate) do nothing;

update public.commercial_rules
set
  net_amount = round(net_amount / 1530, 6),
  gross_amount = round(gross_amount / 1530, 6),
  currency = 'USD',
  notes = concat_ws(E'\n', nullif(notes, ''), 'Conversión de ARS a USD a TC 1530 del 2026-09-14.'),
  override_reason = concat_ws(' · ', nullif(override_reason, ''), 'Normalización a USD a TC 1530'),
  responsible_email = 'felipe@grupopoliplast.com.ar'
where status = 'confirmado' and currency = 'ARS';
