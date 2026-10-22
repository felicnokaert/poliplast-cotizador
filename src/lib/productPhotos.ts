import { supabase } from './supabase'

const BUCKET = 'product-photos'

export interface BucketPhoto {
  path: string
  url: string
}

export async function listBucketPhotos(): Promise<BucketPhoto[]> {
  const { data, error } = await supabase.storage.from(BUCKET).list('', { limit: 500, sortBy: { column: 'created_at', order: 'desc' } })
  if (error) throw error
  return (data ?? [])
    .filter((item) => item.id)
    .map((item) => ({ path: item.name, url: supabase.storage.from(BUCKET).getPublicUrl(item.name).data.publicUrl }))
}

export function productPhotoUrl(path: string | null | undefined): string | null {
  if (!path) return null
  // Fotos aprobadas desde Mercado Libre en el CRM: ya vienen como URL completa.
  if (/^https?:\/\//i.test(path)) return path
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
}

export async function setCatalogProductPhoto(productId: string, photoPath: string | null): Promise<void> {
  const { error } = await supabase.from('catalog_products').update({ photo_path: photoPath, updated_at: new Date().toISOString() }).eq('id', productId)
  if (error) throw error
}

function slugifyFileName(name: string): string {
  const dot = name.lastIndexOf('.')
  const base = dot > 0 ? name.slice(0, dot) : name
  const ext = dot > 0 ? name.slice(dot) : ''
  const safe = base
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
  return `${safe || 'foto'}-${Date.now()}${ext.toLowerCase()}`
}

/** Borra la foto del bucket y la desasigna de cualquier producto que la tuviera puesta. */
export async function deleteBucketPhoto(path: string): Promise<void> {
  const { error: unassignError } = await supabase.from('catalog_products').update({ photo_path: null, updated_at: new Date().toISOString() }).eq('photo_path', path)
  if (unassignError) throw unassignError
  const { error } = await supabase.storage.from(BUCKET).remove([path])
  if (error) throw error
}

/** Sube el archivo al bucket y lo asigna al producto en un solo paso. */
export async function uploadProductPhoto(productId: string, file: File): Promise<string> {
  const path = slugifyFileName(file.name)
  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false })
  if (uploadError) throw uploadError
  await setCatalogProductPhoto(productId, path)
  return path
}

/** Similitud simple por palabras compartidas, para ordenar fotos ya subidas por relevancia a un producto. */
export function photoRelevance(photo: BucketPhoto, productName: string): number {
  const words = (text: string) => new Set(text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length >= 3))
  const productWords = words(productName)
  const photoWords = words(photo.path)
  let shared = 0
  for (const word of productWords) if (photoWords.has(word)) shared += 1
  return shared
}

export interface ApprovedMlPhoto {
  product_id: string
  url: string
}

/**
 * Fotos aprobadas en el CRM (tabla catalog_product_photos, origen Mercado Libre): se usan solo si el producto no
 * tiene foto propia. No escribe nada en catalog_products: es un valor de lectura que se calcula al cargar el catálogo.
 */
export function applyApprovedPhotos<P extends { id: string; photo_path?: string | null }>(products: P[], photos: ApprovedMlPhoto[]): P[] {
  if (!photos.length) return products
  const byProduct = new Map(photos.filter((photo) => photo.url).map((photo) => [photo.product_id, photo.url]))
  return products.map((product) => (!product.photo_path && byProduct.has(product.id) ? { ...product, photo_path: byProduct.get(product.id)! } : product))
}
