-- Historial compartido de cotizaciones con snapshot comercial por renglón.
create table if not exists public.sales_quotes (
  id uuid primary key default gen_random_uuid(),
  quote_number text not null unique,
  owner_id uuid not null references auth.users(id) on delete restrict,
  client_name text not null default '',
  contact_name text not null default '',
  phone text not null default '',
  email text not null default '',
  notes text not null default '',
  payment_method text not null default 'transferencia',
  price_mode text not null default 'automatico' check (price_mode in ('automatico','consumidor_final','mayorista')),
  valid_days integer not null default 7 check (valid_days > 0),
  discount_percent numeric(8,4) not null default 0 check (discount_percent between 0 and 100),
  surcharge_percent numeric(8,4) not null default 0 check (surcharge_percent >= 0),
  exchange_rate numeric(18,6) not null default 0 check (exchange_rate >= 0),
  output_currency text not null default 'USD' check (output_currency in ('USD','ARS')),
  status text not null default 'borrador' check (status in ('borrador','enviada','aceptada','rechazada')),
  issued_at timestamptz not null default now(),
  updated_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sales_quotes_updated_at_idx on public.sales_quotes (updated_at desc);
create index if not exists sales_quotes_status_idx on public.sales_quotes (status, updated_at desc);

create table if not exists public.sales_quote_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.sales_quotes(id) on delete restrict,
  line_key text not null,
  variant_id uuid references public.catalog_variants(id) on delete restrict,
  product_id uuid references public.catalog_products(id) on delete restrict,
  product_name text not null,
  sku text not null,
  brand text not null default '',
  family text not null default '',
  unit text not null default 'unidad',
  quantity numeric(18,6) not null check (quantity > 0),
  unit_amount numeric(18,6),
  currency text check (currency is null or currency in ('USD','ARS')),
  vat_rate numeric(8,6) check (vat_rate is null or vat_rate between 0 and 1),
  price_source text,
  commercial_rule_id uuid references public.commercial_rules(id) on delete restrict,
  line_snapshot jsonb not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (quote_id, line_key)
);

create index if not exists sales_quote_items_quote_idx on public.sales_quote_items (quote_id) where active;
create index if not exists sales_quote_items_sku_idx on public.sales_quote_items (sku);

alter table public.sales_quotes enable row level security;
alter table public.sales_quote_items enable row level security;

grant select, insert, update on public.sales_quotes to authenticated;
grant select, insert, update on public.sales_quote_items to authenticated;
revoke delete on public.sales_quotes from authenticated;
revoke delete on public.sales_quote_items from authenticated;

drop policy if exists "Equipo administra cotizaciones" on public.sales_quotes;
create policy "Equipo administra cotizaciones" on public.sales_quotes for all to authenticated
  using (public.is_poliplast_crm_user())
  with check (public.is_poliplast_crm_user());

drop policy if exists "Equipo administra renglones de cotización" on public.sales_quote_items;
create policy "Equipo administra renglones de cotización" on public.sales_quote_items for all to authenticated
  using (public.is_poliplast_crm_user())
  with check (public.is_poliplast_crm_user());
