// El cotizador adentro del CRM sin barra de desplazamiento propia (Felipe 20/11: «que sea parte del CRM»).
// Mismo contrato que Entregas con EmbeddedAppFrame del CRM:
// - El cotizador avisa su alto: { tipo: 'cotizador:alto', alto } (cada vez que cambia el contenido).
// - El CRM pone el iframe de ese alto y contesta { tipo: 'crm:vista', top, alto } = la parte del iframe que se ve.
//   Recién ahí se activa el modo `alto-auto` (con un CRM viejo no llega y todo sigue como antes).
// - Al cambiar de sección, { tipo: 'app:subir' } para que el CRM lleve la página al principio del cotizador.
// Ventanas, avisos y barras de abajo se ubican con --vista-top / --vista-alto (crm-theme.css).
import { CRM_ORIGINS, isCrmOrigin, isEmbeddedInCrm } from './embed'

function alCrm(mensaje: Record<string, unknown>): void {
  for (const origin of CRM_ORIGINS) {
    try { window.parent.postMessage(mensaje, origin) } catch { /* otro origen */ }
  }
}

/** Avisa al CRM que se cambió de sección (solo si el alto automático está andando). */
export function subirEnCrm(doc: Document = document): void {
  if (doc.documentElement.classList.contains('alto-auto')) alCrm({ tipo: 'app:subir' })
}

/** Arranca el alto automático. Devuelve la función para apagarlo. */
export function altoAutomaticoEnCrm(doc: Document = document): () => void {
  if (!isEmbeddedInCrm()) return () => {}
  const html = doc.documentElement
  const contenido = doc.getElementById('root') ?? doc.body
  let ultimo = 0

  const avisar = () => {
    const alto = Math.ceil(contenido.getBoundingClientRect().height)
    if (alto <= 0 || alto === ultimo) return
    ultimo = alto
    alCrm({ tipo: 'cotizador:alto', alto })
  }
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(avisar) : null
  ro?.observe(contenido)
  avisar()

  const onMessage = (event: MessageEvent) => {
    if (!isCrmOrigin(event.origin) || event.source !== window.parent) return
    const d = event.data as { tipo?: string; top?: unknown; alto?: unknown }
    if (d?.tipo !== 'crm:vista') return
    const top = Math.max(0, Number(d.top) || 0)
    const alto = Math.max(160, Number(d.alto) || 0)
    html.classList.add('alto-auto')
    html.style.setProperty('--vista-top', `${top}px`)
    html.style.setProperty('--vista-alto', `${alto}px`)
  }
  window.addEventListener('message', onMessage)
  return () => {
    ro?.disconnect()
    window.removeEventListener('message', onMessage)
    html.classList.remove('alto-auto')
  }
}
