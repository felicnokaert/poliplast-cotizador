import { Component, type ErrorInfo, type ReactNode } from 'react'

/** Si algo se rompe al mostrar la pantalla, en vez de dejarla en blanco se avisa y se ofrece recargar (el borrador está guardado en este equipo). */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('Error en el cotizador', error, info.componentStack) }
  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="centered-page" role="alert">
        <h1>Algo salió mal</h1>
        <p>Tu borrador está guardado en este equipo. Recargá la página para seguir.</p>
        <button type="button" className="primary-action inline" onClick={() => window.location.reload()}>Recargar</button>
      </div>
    )
  }
}
