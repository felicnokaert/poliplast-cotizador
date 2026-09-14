alter table public.commercial_rules add column if not exists max_quantity numeric;
alter table public.commercial_rules drop constraint if exists commercial_rules_quantity_range;
alter table public.commercial_rules add constraint commercial_rules_quantity_range
  check (max_quantity is null or max_quantity >= min_quantity);

-- Las reglas importadas se retiran de la operación, pero se conservan como
-- historial auditable. Felipe cargará las nuevas condiciones desde Administración.
update public.commercial_rules
set status = 'vencido', valid_until = current_date,
    override_reason = concat_ws(' · ', nullif(override_reason, ''), 'Limpieza solicitada por Felipe; condiciones a recargar manualmente')
where status = 'confirmado';

-- Los importes unitarios Penosil sí eran válidos; dejan de ser reglas "por caja"
-- y pasan a una lista mayorista normal. La condición global se evalúa aparte.
do $$
declare v_list_id uuid;
begin
  insert into public.price_lists(name, brand, currency, vat_rate, valid_from, source, status, created_by_email)
  values ('Penosil Mayorista', 'Penosil', 'USD', .21, current_date,
          'Lista Penosil 2025/2026; condición global de compra, cajas mezclables', 'vigente',
          'felipe@grupopoliplast.com.ar')
  returning id into v_list_id;

  insert into public.variant_prices(price_list_id, variant_id, min_quantity, max_quantity, amount, status, override_reason, created_by_email)
  select v_list_id, cv.id, 1, null,
         round(cr.gross_amount * greatest(coalesce(nullif(cv.attributes->>'units_per_pack','')::numeric, 1), 1), 6),
         'confirmado', 'Precio trasladado desde regla Penosil; sin mínimo individual por caja',
         'felipe@grupopoliplast.com.ar'
  from public.commercial_rules cr
  join public.catalog_variants cv on cv.attributes->>'pack_group' = cr.pack_group
  where cr.aggregate_by_pack_group = true
    and cr.source like 'LISTA DE PRECIOS PENOSIL%'
    and not exists (
      select 1 from public.variant_prices vp where vp.price_list_id = v_list_id and vp.variant_id = cv.id
    );
end $$;

create table if not exists public.wholesale_order_policies (
  id uuid primary key default gen_random_uuid(),
  brand text not null unique,
  threshold_net_usd numeric not null check (threshold_net_usd >= 0),
  vat_rate numeric not null default .21 check (vat_rate between 0 and 1),
  mix_products boolean not null default true,
  active boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by_email text not null default ''
);
alter table public.wholesale_order_policies enable row level security;
grant select, insert, update on public.wholesale_order_policies to authenticated;
create policy "Equipo lee mínimos mayoristas" on public.wholesale_order_policies
  for select to authenticated using (public.is_poliplast_crm_user());
create policy "Admin administra mínimos mayoristas" on public.wholesale_order_policies
  for all to authenticated using (public.is_poliplast_crm_admin()) with check (public.is_poliplast_crm_admin());

insert into public.wholesale_order_policies(brand, threshold_net_usd, vat_rate, mix_products, updated_by_email)
values ('Penosil', 1800, .21, true, 'felipe@grupopoliplast.com.ar')
on conflict (brand) do update set threshold_net_usd=excluded.threshold_net_usd, vat_rate=excluded.vat_rate,
  mix_products=excluded.mix_products, active=true, updated_at=now(), updated_by_email=excluded.updated_by_email;
