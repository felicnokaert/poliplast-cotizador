-- Configuración comercial compartida y numeración correlativa atómica.
create table if not exists public.payment_policies (
  id text primary key,
  name text not null,
  customer_text text not null default '',
  discount_percent numeric(8,4) not null default 0 check (discount_percent between 0 and 100),
  surcharge_percent numeric(8,4) not null default 0 check (surcharge_percent >= 0),
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

alter table public.payment_policies enable row level security;
grant select on public.payment_policies to authenticated;
grant insert, update on public.payment_policies to authenticated;
drop policy if exists "Equipo lee políticas de pago" on public.payment_policies;
create policy "Equipo lee políticas de pago" on public.payment_policies for select to authenticated
  using (public.is_poliplast_crm_user());
drop policy if exists "Admin administra políticas de pago" on public.payment_policies;
create policy "Admin administra políticas de pago" on public.payment_policies for all to authenticated
  using (public.is_poliplast_crm_admin()) with check (public.is_poliplast_crm_admin());

insert into public.payment_policies (id, name, customer_text, sort_order) values
  ('transferencia', 'Transferencia', 'Pago mediante transferencia bancaria.', 10),
  ('contado', 'Contado', 'Pago contado.', 20),
  ('cuenta_corriente', 'Cuenta corriente', 'Sujeto a cuenta corriente aprobada.', 30),
  ('tarjeta', 'Tarjeta / cuotas', 'Recargo o financiación según condición confirmada.', 40)
on conflict (id) do nothing;

create sequence if not exists public.sales_quote_number_seq start 1;
select setval(
  'public.sales_quote_number_seq',
  greatest(coalesce((select max(quote_number::integer) from public.sales_quotes where quote_number ~ '^[0-9]+$'), 0), 1),
  coalesce((select max(quote_number::integer) from public.sales_quotes where quote_number ~ '^[0-9]+$'), 0) > 0
);

grant usage, select, update on sequence public.sales_quote_number_seq to authenticated;

create or replace function public.reserve_sales_quote_number()
returns text language plpgsql security invoker set search_path = public as $$
begin
  if not public.is_poliplast_crm_user() then raise exception 'Acceso denegado'; end if;
  return lpad(nextval('public.sales_quote_number_seq')::text, 4, '0');
end $$;
revoke all on function public.reserve_sales_quote_number() from public;
grant execute on function public.reserve_sales_quote_number() to authenticated;
