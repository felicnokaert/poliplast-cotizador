# Cotizador comercial Grupo Poliplast

Herramienta interna para que el equipo prepare propuestas de Grupo Poliplast. Es una aplicación separada del CRM (`poliplast-sales-copilot`) que comparte catálogo, precios, fichas técnicas e inventario en Supabase.

Fuentes de diseño (viven en el repo del CRM):

- `docs/COTIZADOR_COMERCIAL_SPEC.md`
- `docs/ADR-001-COTIZADOR_APLICACION_SEPARADA.md`
- `docs/ADR-002-CATALOGO_PRECIOS_INVENTARIO_COMPARTIDOS.md`
- `docs/MIGRACION_CATALOGO_COTIZADOR_INVENTARIO.sql`

## Funciones operativas

- login corporativo y permisos RLS;
- catálogo canónico, búsqueda y filtros;
- cotización numerada con cliente, contacto, productos y cantidades;
- escalas automáticas por cantidad, moneda, IVA y vigencia;
- descuento y recargo explícitos sin alterar listas maestras;
- vista previa, impresión/PDF y texto para WhatsApp;
- recuperación automática de la cotización en curso y guardado deliberado en historial local;
- cotización vendedor billete del BNA como fuente principal, con respaldo identificado;
- identidad por marca y co-branding Grupo Poliplast;
- panel administrativo protegido con exportación completa de precios, costos y stock, más importación CSV en modo vista previa con validación por SKU.

Pendiente para la siguiente capa: persistencia compartida de cotizaciones, vínculo formal con clientes/fichas, editor masivo con vista previa y reglas aprobadas de margen/financiación. Hasta entonces no se inventan condiciones ni se exponen costos al vendedor. Los logos oficiales de Resinplast, Penosil y PURMAC deben incorporarse cuando se disponga de sus archivos aprobados; no se reemplazan por imitaciones.

No se modifica el CRM ni se crean tablas nuevas: todo se lee de las tablas ya migradas en el proyecto Supabase `poli crm` (`nghwmtccpovrdtzvllwe`).

## Desarrollo local

```bash
npm install
cp .env.example .env.local   # completar VITE_SUPABASE_ANON_KEY
npm run dev
```

## Variables de entorno

Ver `.env.example`. Usa el mismo proyecto Supabase que el CRM — no se duplican datos ni credenciales de servicio (no hay `SERVICE_ROLE_KEY` en el frontend).
