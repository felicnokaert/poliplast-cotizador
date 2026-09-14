# ADR-003: Cotizaciones compartidas con snapshot histórico

**Estado:** Implementado y verificado en Supabase  
**Fecha:** 12/09/2026  
**Decisores:** Felipe / Codex

## Contexto

Los borradores hoy quedan en `localStorage`: protegen el trabajo individual, pero no aparecen en otro equipo. Además, un documento histórico no debe cambiar si luego cambia el nombre, IVA o precio del catálogo.

## Decisión

Usar `sales_quotes` y `sales_quote_items` en el Supabase compartido. Cada renglón guarda referencias al catálogo y también el snapshot comercial emitido. La caché local permanece como recuperación ante fallas de red.

No se habilita DELETE. Un renglón retirado se marca `active=false`; así el historial es reversible y auditable. RLS permite leer y editar al equipo autorizado, registrando al último usuario que actualizó.

## Opciones descartadas

- **Solo navegador:** simple, pero aísla usuarios y equipos.
- **Guardar el documento completo como JSON:** rápido, pero dificulta filtros, métricas y auditoría por SKU.
- **Recalcular siempre desde catálogo:** altera cotizaciones históricas cuando cambia una lista.

## Consecuencias

- Se podrán abrir cotizaciones desde distintas cuentas/equipos.
- Será posible medir enviadas, aceptadas y rechazadas sin duplicar datos en el CRM.
- La escritura remota debe fallar de forma visible y conservar el respaldo local.
- La migración debe aplicarse antes de activar la sincronización en la interfaz.

## Verificación operativa

Aplicado en `poli crm` el 14/09/2026. Se verificaron RLS en ambas tablas,
escritura transaccional con rollback y guardado real de la cotización `0001`
con dos renglones y snapshot histórico. El respaldo local continúa activo.
