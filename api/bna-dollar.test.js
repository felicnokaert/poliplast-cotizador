import { describe, expect, it } from 'vitest'
import { parseBnaHtml } from './bna-dollar.js'

describe('lector de cotización BNA', () => {
  it('extrae la venta de billetes y no la cotización de divisas', () => {
    const html = `<div id="billetes"><table><thead><tr><th class="fechaCot">11/9/2026</th><th>Compra</th><th>Venta</th></tr></thead><tbody><tr><td class="tit">Dolar U.S.A</td><td>1480,00</td><td>1530,00</td></tr></tbody></table></div><div id="divisas"><table><tr><td class="tit">Dolar U.S.A</td><td>1499.5000</td><td>1508.5000</td></tr></table></div>`
    expect(parseBnaHtml(html)).toEqual({ rate: 1530, quotationDate: '11/9/2026' })
  })

  it('falla cerrado si cambia la estructura oficial', () => {
    expect(parseBnaHtml('<html>sin cotización</html>')).toBeNull()
  })
})
