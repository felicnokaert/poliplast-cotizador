# Reglas comerciales administrables por SKU/familia

**Estado:** aplicado a Supabase (`poli crm`, `nghwmtccpovrdtzvllwe`) el 12/09/2026.
**Fecha de la propuesta original:** 12/09/2026

## Ajustes aprobados sobre la propuesta original

- Comparadores `gt` y `gte` soportados (no solo `gt`).
- `responsible_user_id` (FK a `auth.users`, nullable) + `responsible_email` (texto, obligatorio si no hay usuario).
- Sin tabla de historial separada: se agregó `supersedes_rule_id` (autorreferencia) para encadenar reemplazos sobre filas insert-only.
- Se persisten `net_amount`, `vat_rate` **y** `gross_amount` (precio final con IVA), con un `check` que valida la consistencia entre los tres.
- Resolución: SKU → familia → (ninguna, cae a `variant_prices`); empate de scope lo resuelve el umbral de cantidad más alto que la cantidad todavía cumple; una regla superseded se ignora si su reemplazo ya es vigente.
- El cotizador (pendiente, no implementado todavía) deberá mostrar siempre el precio **final con IVA incluido** más la explicación de qué regla se aplicó — la función `resolveCommercialRule` en `src/lib/commercialRules.ts` ya devuelve ambos.

## Qué ya existe (revisado antes de proponer nada nuevo)

- `price_lists`: una lista con moneda, IVA, vigencia, fuente y estado. Hoy solo hay 1 fila (la del Catálogo Maestro).
- `variant_prices`: precio por **variante puntual** (`variant_id` obligatorio), con `min_quantity`/`max_quantity` como escala **inclusiva** (`>=`), moneda heredada de la lista, `status`/`override_reason` para excepciones.

Ninguna de las dos puede expresar "toda la familia Almohadas, cantidad estrictamente mayor a 200" sin enumerar cada SKU de la familia a mano — y enumerar a mano rompe apenas se agregue un SKU nuevo a Almohadas. Por eso no alcanza con una fila más en `variant_prices`.

## Qué se agrega

Una tabla nueva, `commercial_rules`, que expresa una **regla** (no un precio de catálogo): se aplica a un SKU puntual o a toda una familia, con un umbral de cantidad, y resuelve un precio neto + IVA. No reemplaza ni duplica `price_lists`/`variant_prices` — convive con ellas. El motor de cotización decide en tiempo de armado de línea si hay una regla aplicable (por SKU primero, por familia después) antes de caer al precio de lista general.

Sigue el mismo vocabulario y filosofía que el resto del esquema (ver `variant_prices`/`catalog_cost_revisions`):

- **Insert-only, sin UPDATE:** un cambio de condición se registra como una fila nueva (con su propio `created_at`, `created_by`, `source`); nunca se pisa una fila existente. El valor anterior queda intacto para auditoría, igual que en `catalog_cost_revisions`.
- Mismos estados (`pendiente`, `confirmado`, `vencido`, `excepcion_manual`) y mismo campo `override_reason` obligatorio cuando el estado es `excepcion_manual`.
- Reutiliza `catalog_import_jobs` para trazabilidad si en el futuro se cargan reglas en lote (no se crea una tabla de lotes nueva).
- RLS con el mismo patrón: lectura para cualquier usuario del equipo, escritura solo para admin, sin DELETE para autenticados (revertir es agregar una fila que anula la anterior, no borrar).

## Migración propuesta (aditiva, no aplicada)

```sql
-- Reglas comerciales por SKU o por familia, con umbral de cantidad.
-- Migración aditiva. No modifica price_lists ni variant_prices.

create table if not exists public.commercial_rules (
  id uuid primary key default gen_random_uuid(),
  scope_type text not null check (scope_type in ('family', 'sku')),
  family text,
  variant_id uuid references public.catalog_variants(id) on delete restrict,
  quantity_comparator text not null default 'gt' check (quantity_comparator in ('gt', 'gte')),
  min_quantity numeric(18,6) not null check (min_quantity > 0),
  net_amount numeric(18,6) not null check (net_amount >= 0),
  currency text not null check (currency in ('ARS', 'USD')),
  vat_rate numeric(8,6) not null check (vat_rate between 0 and 1),
  unit text not null default 'unidad',
  valid_from date not null default current_date,
  valid_until date,
  source text not null,
  status text not null default 'confirmado' check (status in ('pendiente', 'confirmado', 'vencido', 'excepcion_manual')),
  override_reason text not null default '',
  responsible_user_id uuid references auth.users(id) on delete set null,
  responsible_email text,
  notes text not null default '',
  import_job_id uuid references public.catalog_import_jobs(id) on delete restrict,
  created_by uuid references auth.users(id) on delete set null,
  created_by_email text,
  created_at timestamptz not null default now(),
  constraint commercial_rules_scope_family check (
    scope_type <> 'family' or (family is not null and variant_id is null)
  ),
  constraint commercial_rules_scope_sku check (
    scope_type <> 'sku' or (variant_id is not null and family is null)
  ),
  constraint commercial_rules_validity check (valid_until is null or valid_until >= valid_from),
  constraint commercial_rules_override_reason check (
    status <> 'excepcion_manual' or btrim(override_reason) <> ''
  )
);

create index if not exists commercial_rules_family_idx
  on public.commercial_rules (family) where scope_type = 'family';
create index if not exists commercial_rules_variant_idx
  on public.commercial_rules (variant_id) where scope_type = 'sku';
create index if not exists commercial_rules_valid_from_idx
  on public.commercial_rules (valid_from desc);

alter table public.commercial_rules enable row level security;

revoke all on public.commercial_rules from anon;
grant select on public.commercial_rules to authenticated;
grant select, insert on public.commercial_rules to authenticated;

drop policy if exists "Equipo lee reglas comerciales" on public.commercial_rules;
create policy "Equipo lee reglas comerciales" on public.commercial_rules for select to authenticated
using (public.is_poliplast_crm_user());

drop policy if exists "Admin administra reglas comerciales" on public.commercial_rules;
create policy "Admin administra reglas comerciales" on public.commercial_rules for all to authenticated
using (public.is_poliplast_crm_admin()) with check (public.is_poliplast_crm_admin());

-- Sin DELETE para autenticados: una regla se anula agregando una fila nueva,
-- no borrando la anterior (misma política que el resto del catálogo).
revoke delete on public.commercial_rules from authenticated;
```

## Cómo se resolvería en el motor de cotización (sin código todavía, solo la consulta)

Para una línea con `variant_id` y `cantidad`, en este orden de prioridad:

```sql
select *
from public.commercial_rules
where status = 'confirmado'
  and valid_from <= current_date
  and (valid_until is null or valid_until >= current_date)
  and (
    (scope_type = 'sku' and variant_id = :variant_id)
    or (scope_type = 'family' and family = (
      select family from public.catalog_products cp
      join public.catalog_variants cv on cv.product_id = cp.id
      where cv.id = :variant_id
    ))
  )
  and (
    (quantity_comparator = 'gt' and :cantidad > min_quantity)
    or (quantity_comparator = 'gte' and :cantidad >= min_quantity)
  )
order by
  (scope_type = 'sku') desc,      -- una regla por SKU puntual gana sobre una de familia
  min_quantity desc,               -- el umbral más alto que la cantidad todavía cumple
  valid_from desc                  -- la más reciente entre empates
limit 1;
```

Si no hay ninguna fila, se cae al precio de `variant_prices` como hoy.

## Caso inicial confirmado (para cargar una vez aprobada la migración)

```sql
insert into public.commercial_rules
  (scope_type, family, quantity_comparator, min_quantity, net_amount, currency, vat_rate, unit, valid_from, source, status, responsible_email, created_by_email)
values
  ('family', 'Almohadas', 'gt', 200, 5.15, 'USD', 0.21, 'unidad', current_date,
   'Confirmado por Felipe, 12/09/2026', 'confirmado', 'felipe@grupopoliplast.com.ar', 'marketing@grupopoliplast.com.ar');
```

`Almohadas` es el valor exacto de `catalog_products.family` ya presente en la base (42 productos, verificado).

## Regla inicial cargada

`commercial_rules.id = 6d034b0b-10af-4e20-92f5-fc7ad2e70953`: familia `Almohadas`, cantidad `> 200`, USD 5.15 neto, IVA 21%, USD 6.2315 final, `status = 'confirmado'`, responsable `felipe@grupopoliplast.com.ar`.

## Pendiente

El motor de resolución (`src/lib/commercialRules.ts`, con tests de límite en 200/201 unidades) está listo y probado, pero **todavía no está conectado al frontend del cotizador** — eso queda para el próximo paso, a pedido explícito de Felipe de confirmar primero que migración + resolución + tests funcionan antes de tocar la UI.
