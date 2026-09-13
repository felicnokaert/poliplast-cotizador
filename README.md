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
- vista previa y mensaje comercial para WhatsApp; el comprobante/PDF fiscal se genera luego en Contabilium;
- recuperación automática de la cotización en curso y guardado deliberado en historial local;
- cotización vendedor billete del BNA como fuente principal, con respaldo identificado;
- identidad por marca y co-branding Grupo Poliplast;
- panel administrativo protegido con exportación completa de precios, costos y stock;
- importación CSV validada por SKU y aplicación de costos como revisiones nuevas, con lote auditable y reversión sin borrado;
- lectura de stock aprobado y advertencia cuando una cotización supera la disponibilidad verificada;
- fichas técnicas visibles únicamente mediante vínculos formales verificados.

La persistencia compartida y la importación reversible de costos ya tienen código y migraciones preparadas en el repo del CRM, pero deben aplicarse al proyecto Supabase antes de considerarlas operativas. Pendiente para la siguiente capa: aplicación masiva de precios mediante listas versionadas, importación de stock mediante conteos por depósito, reglas aprobadas de margen/financiación y vínculos técnicos reales cargados. Hasta entonces no se inventan condiciones ni se exponen costos al vendedor. Los logos oficiales de Resinplast, Penosil y PURMAC deben incorporarse cuando se disponga de sus archivos aprobados; no se reemplazan por imitaciones.

La migración `supabase/migrations/20260913_commercial_policies_and_quote_numbers.sql` agrega políticas de pago compartidas y numeración correlativa atómica. Debe aplicarse al proyecto Supabase `poli crm` (`nghwmtccpovrdtzvllwe`) antes de publicar esta versión; el frontend mantiene valores seguros de respaldo si todavía no está aplicada.

## Desarrollo local

```bash
npm install
cp .env.example .env.local   # completar VITE_SUPABASE_ANON_KEY
npm run dev
```

## Variables de entorno

Ver `.env.example`. Usa el mismo proyecto Supabase que el CRM — no se duplican datos ni credenciales de servicio (no hay `SERVICE_ROLE_KEY` en el frontend).
