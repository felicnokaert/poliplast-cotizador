import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { productPhotoUrl } from '../lib/productPhotos'

function initials(name: string) {
  const words = name.normalize('NFD').replace(/[̀-ͯ]/g, '').split(/[^A-Za-z]+/).filter((word) => word.length > 1)
  return ((words[0]?.[0] ?? '·') + (words[1]?.[0] ?? '')).toUpperCase()
}

/** Miniatura del producto; sin foto (o si no carga) muestra las iniciales. Un toque la agranda. */
export function ProductThumb({ photoPath, name, size = 'md' }: { photoPath?: string | null; name: string; size?: 'sm' | 'md' }) {
  const url = productPhotoUrl(photoPath)
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const [zoom, setZoom] = useState(false)
  useEffect(() => {
    if (!zoom) return undefined
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setZoom(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [zoom])
  if (!url || failedUrl === url) return <span className={`product-thumb product-thumb-${size} product-thumb-empty`} aria-hidden="true">{initials(name)}</span>
  return (
    <>
      <button type="button" className={`product-thumb product-thumb-${size}`} aria-label={`Ver foto de ${name}`} onClick={(event) => { event.stopPropagation(); setZoom(true) }}>
        <img src={url} alt="" loading="lazy" decoding="async" onError={() => setFailedUrl(url)} />
      </button>
      {zoom && (
        <div className="modal-backdrop photo-lightbox no-print" role="dialog" aria-modal="true" aria-label={`Foto de ${name}`} onClick={() => setZoom(false)}>
          <figure onClick={(event) => event.stopPropagation()}>
            <img src={url} alt={name} />
            <figcaption>{name}</figcaption>
            <button type="button" className="photo-lightbox-close" aria-label="Cerrar foto" onClick={() => setZoom(false)}><X size={18} /></button>
          </figure>
        </div>
      )}
    </>
  )
}
