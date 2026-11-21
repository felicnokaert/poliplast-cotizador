// Modo oscuro (21/11): dentro del CRM el cotizador toma el tema del CRM (?tema=dark|light al abrir y { tipo: 'crm:tema' }
// cada vez que cambia); suelto sigue al dispositivo (src/dark-theme.css). Lo impreso y la vista previa quedan claros.
import { isCrmOrigin, isEmbeddedInCrm } from './embed'

export type Tema = 'dark' | 'light'

export function temaValido(valor: unknown): Tema | null {
  return valor === 'dark' || valor === 'light' ? valor : null
}

export function aplicarTema(tema: Tema | null, root: HTMLElement = document.documentElement): void {
  if (tema) root.dataset.theme = tema
  else delete root.dataset.theme
}

export function seguirTemaDelCrm(win: Window = window): () => void {
  if (!isEmbeddedInCrm(win)) return () => {}
  try { aplicarTema(temaValido(new URLSearchParams(win.location.search).get('tema')), win.document.documentElement) } catch { /* sin dirección */ }
  const onMessage = (event: MessageEvent) => {
    if (!isCrmOrigin(event.origin) || event.source !== win.parent) return
    const data = event.data as { tipo?: string; tema?: string }
    if (data?.tipo === 'crm:tema') aplicarTema(temaValido(data.tema), win.document.documentElement)
  }
  win.addEventListener('message', onMessage)
  return () => win.removeEventListener('message', onMessage)
}
