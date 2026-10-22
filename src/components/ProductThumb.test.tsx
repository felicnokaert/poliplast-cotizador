import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../lib/supabase', () => ({ supabase: { storage: { from: () => ({ getPublicUrl: (path: string) => ({ data: { publicUrl: `https://cdn.test/product-photos/${path}` } }) }) } } }))

import { ProductThumb } from './ProductThumb'

afterEach(cleanup)

describe('ProductThumb', () => {
  it('sin foto muestra las iniciales del producto, sin botón', () => {
    render(<ProductThumb photoPath={null} name="Balde 10 litros" />)
    expect(screen.getByText('BL')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
  it('con foto la muestra (URL completa o del bucket) y un toque la agranda; Escape la cierra', () => {
    const { container } = render(<ProductThumb photoPath="https://cdn.shopify.com/x/balde.png" name="Balde 10 litros" />)
    expect(container.querySelector('img')?.getAttribute('src')).toBe('https://cdn.shopify.com/x/balde.png')
    fireEvent.click(screen.getByRole('button', { name: 'Ver foto de Balde 10 litros' }))
    expect(screen.getByRole('dialog', { name: 'Foto de Balde 10 litros' })).toBeInTheDocument()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
  it('si la foto no carga vuelve a las iniciales', () => {
    const { container } = render(<ProductThumb photoPath="balde.png" name="Balde 10 litros" />)
    fireEvent.error(container.querySelector('img')!)
    expect(screen.getByText('BL')).toBeInTheDocument()
  })
})
