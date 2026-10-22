import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { Modal } from './Modal'

afterEach(cleanup)

function Harness() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button onClick={() => setOpen(true)}>Abrir</button>
      {open && <Modal label="Ventana" onClose={() => setOpen(false)}><section><button>Uno</button><button>Dos</button></section></Modal>}
    </>
  )
}

describe('Modal accesible', () => {
  it('enfoca el primer control, atrapa Tab, cierra con Escape y devuelve el foco', () => {
    render(<Harness />)
    const opener = screen.getByRole('button', { name: 'Abrir' })
    opener.focus()
    fireEvent.click(opener)
    const dialog = screen.getByRole('dialog', { name: 'Ventana' })
    expect(screen.getByRole('button', { name: 'Uno' })).toHaveFocus()
    screen.getByRole('button', { name: 'Dos' }).focus()
    fireEvent.keyDown(dialog, { key: 'Tab' })
    expect(screen.getByRole('button', { name: 'Uno' })).toHaveFocus()
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true })
    expect(screen.getByRole('button', { name: 'Dos' })).toHaveFocus()
    fireEvent.keyDown(dialog, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(opener).toHaveFocus()
  })
})
