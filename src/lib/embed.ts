// El cotizador mostrado como pestaña del CRM (poli-crm, ?embed=1 dentro de un iframe).
// Dentro del CRM no se guarda ni se renueva la sesión acá: la manda el CRM (y la reenvía cada vez que la
// renueva). Si los dos renovaran el mismo token, uno invalidaría al otro y el CRM se desloguearía.
export const CRM_ORIGINS = ['https://poli-crm.vercel.app', 'http://localhost:5173', 'http://localhost:5181']

export function isEmbeddedInCrm(win: Window = window): boolean {
  try {
    return new URLSearchParams(win.location.search).get('embed') === '1' && win.parent !== win
  } catch {
    return false
  }
}

export function isCrmOrigin(origin: string): boolean {
  return CRM_ORIGINS.includes(origin)
}
