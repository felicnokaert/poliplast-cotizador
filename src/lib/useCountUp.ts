import { useEffect, useRef, useState } from 'react'

const isTestEnv = import.meta.env.MODE === 'test'

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Anima un número desde su valor anterior (0 al cargar) hasta `target` con easing cúbico.
 * El valor final es siempre exactamente `target`: hay un respaldo por timeout por si el navegador
 * pausa las animaciones (pestaña oculta) y se desactiva con prefers-reduced-motion y en tests.
 */
export function useCountUp(target: number, duration = 700): number {
  const skip = isTestEnv || typeof requestAnimationFrame !== 'function' || prefersReducedMotion()
  const [value, setValue] = useState(skip ? target : 0)
  const previous = useRef(skip ? target : 0)

  useEffect(() => {
    if (skip) return
    const from = previous.current
    const start = performance.now()
    let frame = 0
    const finish = () => { previous.current = target; setValue(target) }
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration)
      if (progress >= 1) { finish(); return }
      const eased = 1 - Math.pow(1 - progress, 3)
      const current = from + (target - from) * eased
      previous.current = current
      setValue(current)
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    const safety = window.setTimeout(finish, duration + 150)
    return () => { cancelAnimationFrame(frame); window.clearTimeout(safety) }
  }, [target, duration, skip])

  return skip ? target : value
}
