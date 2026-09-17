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
