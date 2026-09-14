drop policy if exists "Cada usuario ve solo su propio workspace" on public.workspace_states;
create policy "Equipo accede a su workspace y al directorio común"
on public.workspace_states for all to authenticated
using ((workspace_key = (select auth.uid())::text or workspace_key = 'grupo-poliplast') and is_poliplast_crm_user())
with check ((workspace_key = (select auth.uid())::text or workspace_key = 'grupo-poliplast') and is_poliplast_crm_user());

create table if not exists public.commercial_client_phones (
  id uuid primary key default gen_random_uuid(),
  client_key text not null,
  phone text not null,
  label text not null default 'WhatsApp',
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (client_key, phone)
);
create index if not exists commercial_client_phones_created_by_idx on public.commercial_client_phones (created_by);

alter table public.commercial_client_phones enable row level security;
grant select, insert on public.commercial_client_phones to authenticated;
revoke update, delete on public.commercial_client_phones from authenticated;

create policy "Equipo consulta teléfonos comerciales"
on public.commercial_client_phones for select to authenticated
using (is_poliplast_crm_user());

create policy "Equipo agrega teléfonos comerciales"
on public.commercial_client_phones for insert to authenticated
with check (is_poliplast_crm_user() and created_by = (select auth.uid()));

drop policy if exists "Equipo administra cotizaciones" on public.sales_quotes;
create policy "Cada vendedor administra sus cotizaciones"
on public.sales_quotes for all to authenticated
using (owner_id = (select auth.uid()) and is_poliplast_crm_user())
with check (owner_id = (select auth.uid()) and is_poliplast_crm_user());

drop policy if exists "Equipo administra renglones de cotización" on public.sales_quote_items;
create policy "Cada vendedor administra renglones de sus cotizaciones"
on public.sales_quote_items for all to authenticated
using (exists (select 1 from public.sales_quotes q where q.id = quote_id and q.owner_id = (select auth.uid())))
with check (exists (select 1 from public.sales_quotes q where q.id = quote_id and q.owner_id = (select auth.uid())));
