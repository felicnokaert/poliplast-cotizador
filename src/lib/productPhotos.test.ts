import { describe, expect, it, vi } from 'vitest'
import { makeQueryResult } from './supabaseTestUtils'

const { getPublicUrl, storageFrom } = vi.hoisted(() => {
  const getPublicUrl = vi.fn((path: string) => ({ data: { publicUrl: `https://cdn.test/product-photos/${path}` } }))
  const storageFrom = vi.fn(() => ({ getPublicUrl, list: vi.fn(), upload: vi.fn() }))
  return { getPublicUrl, storageFrom }
})

vi.mock('./supabase', () => ({ supabase: { from: vi.fn(), storage: { from: storageFrom } } }))

import { supabase } from './supabase'
import { photoRelevance, productPhotoUrl, setCatalogProductPhoto, uploadProductPhoto, type BucketPhoto } from './productPhotos'

describe('productPhotoUrl', () => {
  it('devuelve null sin foto asignada', () => {
    expect(productPhotoUrl(null)).toBeNull()
    expect(productPhotoUrl(undefined)).toBeNull()
  })
  it('arma la URL pública del bucket', () => {
    expect(productPhotoUrl('balde-10l.png')).toBe('https://cdn.test/product-photos/balde-10l.png')
  })
})

describe('photoRelevance', () => {
  it('cuenta palabras compartidas de 3+ letras', () => {
    const photo: BucketPhoto = { path: 'balde-10l-negro-x5.png', url: '' }
    expect(photoRelevance(photo, 'BALDE 10 LITROS NEGRO CON MANIJA/TAPA X 1')).toBeGreaterThanOrEqual(2)
  })
  it('no encuentra relación entre nombres sin palabras en común', () => {
    const photo: BucketPhoto = { path: 'guantes-nitrilo.jpg', url: '' }
    expect(photoRelevance(photo, 'RESINA EPOXICA CRISTAL 1KG')).toBe(0)
  })
})

describe('setCatalogProductPhoto', () => {
  it('actualiza photo_path en catalog_products', async () => {
    vi.mocked(supabase.from).mockReturnValueOnce(makeQueryResult({ data: null, error: null }) as never)
    await setCatalogProductPhoto('p1', 'foto.png')
    expect(supabase.from).toHaveBeenCalledWith('catalog_products')
  })
  it('propaga el error de Supabase', async () => {
    vi.mocked(supabase.from).mockReturnValueOnce(makeQueryResult({ data: null, error: new Error('fallo') }) as never)
    await expect(setCatalogProductPhoto('p1', 'foto.png')).rejects.toThrow('fallo')
  })
})

describe('uploadProductPhoto', () => {
  it('sube el archivo con un nombre de ruta seguro y lo asigna al producto', async () => {
    const upload = vi.fn(() => Promise.resolve({ error: null }))
    storageFrom.mockReturnValueOnce({ getPublicUrl, list: vi.fn(), upload })
    vi.mocked(supabase.from).mockReturnValueOnce(makeQueryResult({ data: null, error: null }) as never)
    const file = new File(['contenido'], 'Balde Negro 10L.PNG', { type: 'image/png' })
    const path = await uploadProductPhoto('p1', file)
    expect(path).toMatch(/^balde-negro-10l-\d+\.png$/)
    expect(upload).toHaveBeenCalledWith(path, file, { upsert: false })
  })
  it('no asigna la foto si falla la subida', async () => {
    const upload = vi.fn(() => Promise.resolve({ error: new Error('sin espacio') }))
    storageFrom.mockReturnValueOnce({ getPublicUrl, list: vi.fn(), upload })
    const file = new File(['x'], 'foto.jpg')
    await expect(uploadProductPhoto('p1', file)).rejects.toThrow('sin espacio')
    expect(supabase.from).not.toHaveBeenCalled()
  })
})
