# Cotizador Grupo Poliplast

Catálogo comercial navegable de Grupo Poliplast (Resinplast, Penosil, PURMAC y demás familias). Aplicación separada del CRM (`poliplast-sales-copilot`), que comparte la misma base Supabase y las mismas tablas de catálogo, precios, fichas técnicas e inventario.

Fuentes de diseño (viven en el repo del CRM):

- `docs/COTIZADOR_COMERCIAL_SPEC.md`
- `docs/ADR-001-COTIZADOR_APLICACION_SEPARADA.md`
- `docs/ADR-002-CATALOGO_PRECIOS_INVENTARIO_COMPARTIDOS.md`
- `docs/MIGRACION_CATALOGO_COTIZADOR_INVENTARIO.sql`

## Estado de esta primera entrega

Catálogo navegable con:

- login con la misma cuenta de Supabase que usa el equipo en el CRM (auth compartida, RLS por rol);
- búsqueda por nombre, SKU, familia y subfamilia;
- filtros por familia, marca y disponibilidad de precio vigente;
- agrupación por producto con sus variantes debajo, cada una con su SKU;
- precio vigente por variante (o "Precio pendiente" cuando no hay lista aplicable);
- indicador de ficha técnica disponible por variante (match por SKU o por familia+producto contra `technical_documents`).

Explícitamente fuera de esta entrega: generación de PDF, descuentos, integración con clientes del CRM, envío de cotizaciones, panel administrador de altas/importación masiva. El catálogo se puebla escribiendo directamente en `catalog_products` / `catalog_variants` / `price_lists` / `variant_prices` (Supabase) hasta que exista el importador.

No se modifica el CRM ni se crean tablas nuevas: todo se lee de las tablas ya migradas en el proyecto Supabase `poli crm` (`nghwmtccpovrdtzvllwe`).

## Desarrollo local

```bash
npm install
cp .env.example .env.local   # completar VITE_SUPABASE_ANON_KEY
npm run dev
```

## Variables de entorno

Ver `.env.example`. Usa el mismo proyecto Supabase que el CRM — no se duplican datos ni credenciales de servicio (no hay `SERVICE_ROLE_KEY` en el frontend).
