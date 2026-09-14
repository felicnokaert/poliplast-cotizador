create table if not exists public.catalog_price_change_log (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references public.catalog_variants(id) on delete restrict,
  price_kind text not null check (price_kind in ('consumidor_final', 'mayorista')),
  previous_amount numeric,
  new_amount numeric not null check (new_amount >= 0),
  currency text not null check (currency in ('USD', 'ARS')),
  reason text not null,
  changed_by uuid references auth.users(id) on delete restrict,
  changed_by_email text not null default '',
  changed_at timestamptz not null default now()
);

alter table public.catalog_price_change_log enable row level security;
create policy "Admin lee cambios de precio" on public.catalog_price_change_log for select to authenticated using (public.is_poliplast_crm_admin());
create policy "Admin registra cambios de precio" on public.catalog_price_change_log for insert to authenticated with check (public.is_poliplast_crm_admin() and changed_by = auth.uid());
grant select, insert on public.catalog_price_change_log to authenticated;

create or replace function public.admin_set_variant_price(
  p_variant_id uuid,
  p_kind text,
  p_amount numeric,
  p_currency text,
  p_reason text
) returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_price_id uuid;
  v_list_id uuid;
  v_previous numeric;
  v_brand text;
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if not public.is_poliplast_crm_admin() then raise exception 'Sin permiso administrativo'; end if;
  if p_kind not in ('consumidor_final', 'mayorista') then raise exception 'Tipo de precio inválido'; end if;
  if p_currency not in ('USD', 'ARS') then raise exception 'Moneda inválida'; end if;
  if p_amount < 0 then raise exception 'El precio no puede ser negativo'; end if;
  if length(trim(p_reason)) < 3 then raise exception 'Indicá el motivo o fuente del cambio'; end if;

  select vp.id, vp.amount into v_price_id, v_previous
  from public.variant_prices vp join public.price_lists pl on pl.id = vp.price_list_id
  where vp.variant_id = p_variant_id and vp.status = 'confirmado' and pl.status = 'vigente'
    and ((p_kind = 'mayorista' and pl.name ~* '(mayorista|distribuidor)') or (p_kind = 'consumidor_final' and pl.name !~* '(mayorista|distribuidor)'))
  order by pl.valid_from desc, vp.created_at desc limit 1;

  if v_price_id is not null then
    update public.variant_prices set amount = p_amount, override_reason = trim(p_reason), created_by = auth.uid(), created_by_email = v_email where id = v_price_id;
  else
    select cp.brand into v_brand from public.catalog_variants cv join public.catalog_products cp on cp.id = cv.product_id where cv.id = p_variant_id;
    select pl.id into v_list_id from public.price_lists pl
    where pl.status = 'vigente' and pl.currency = p_currency and lower(pl.brand) = lower(v_brand)
      and ((p_kind = 'mayorista' and pl.name ~* '(mayorista|distribuidor)') or (p_kind = 'consumidor_final' and pl.name !~* '(mayorista|distribuidor)'))
    order by pl.valid_from desc limit 1;
    if v_list_id is null then
      insert into public.price_lists(name, brand, currency, vat_rate, valid_from, source, status, created_by, created_by_email)
      values (v_brand || case when p_kind = 'mayorista' then ' Mayorista manual' else ' Minorista manual' end, v_brand, p_currency, .21, current_date, trim(p_reason), 'vigente', auth.uid(), v_email)
      returning id into v_list_id;
    end if;
    insert into public.variant_prices(price_list_id, variant_id, amount, min_quantity, status, override_reason, created_by, created_by_email)
    values (v_list_id, p_variant_id, p_amount, 1, 'confirmado', trim(p_reason), auth.uid(), v_email)
    returning id into v_price_id;
  end if;

  insert into public.catalog_price_change_log(variant_id, price_kind, previous_amount, new_amount, currency, reason, changed_by, changed_by_email)
  values (p_variant_id, p_kind, v_previous, p_amount, p_currency, trim(p_reason), auth.uid(), v_email);
  return v_price_id;
end;
$$;

revoke execute on function public.admin_set_variant_price(uuid,text,numeric,text,text) from public, anon;
grant execute on function public.admin_set_variant_price(uuid,text,numeric,text,text) to authenticated, service_role;
