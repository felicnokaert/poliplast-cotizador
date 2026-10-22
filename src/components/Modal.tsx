import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'

/**
 * Ventana modal accesible: foco inicial en el primer control, Tab que no se escapa a la página de atrás, Escape para cerrar
 * y el foco vuelve al botón que la abrió.
 */
export function Modal({ label, onClose, className = '', closeOnBackdrop = false, children }: { label: string; onClose: () => void; className?: string; closeOnBackdrop?: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const closeRef = useRef(onClose)
  useEffect(() => { closeRef.current = onClose })
  useEffect(() => {
    const root = ref.current
    if (!root) return undefined
    const previous = document.activeElement as HTMLElement | null
    const focusables = () => [...root.querySelectorAll<HTMLElement>(FOCUSABLE)]
    ;(focusables()[0] ?? root).focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.stopPropagation(); closeRef.current(); return }
      if (event.key !== 'Tab') return
      const list = focusables()
      if (!list.length) { event.preventDefault(); return }
      const first = list[0], last = list[list.length - 1]
      if (event.shiftKey && (document.activeElement === first || document.activeElement === root)) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    root.addEventListener('keydown', onKey)
    return () => { root.removeEventListener('keydown', onKey); previous?.focus?.() }
  }, [])
  // En un portal sobre <body>: un modal dentro de una fila o tarjeta con transform/filter/backdrop-filter queda
  // encerrado en esa caja (la foto ampliada se veía solo en la franja del producto).
  return createPortal(
    <div ref={ref} tabIndex={-1} className={`modal-backdrop ${className}`.trim()} role="dialog" aria-modal="true" aria-label={label} onClick={closeOnBackdrop ? () => closeRef.current() : undefined}>
      {children}
    </div>,
    document.body,
  )
}
