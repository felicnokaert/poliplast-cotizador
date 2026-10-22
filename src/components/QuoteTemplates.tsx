import { useState } from 'react'
import { BookmarkPlus, Trash2 } from 'lucide-react'
import type { QuoteTemplate } from '../lib/templates'

/** Plantillas de cotización: guardar la cotización actual y volver a cargar combinaciones que se repiten. */
export function QuoteTemplates({ templates, canSave, ready, onSave, onUse, onDelete }: {
  templates: QuoteTemplate[]
  canSave: boolean
  /** Falta cargar el catálogo de hoy: no se pueden usar todavía. */
  ready: boolean
  onSave: (name: string) => void
  onUse: (template: QuoteTemplate) => void
  onDelete: (template: QuoteTemplate) => void
}) {
  const [naming, setNaming] = useState(false)
  const [name, setName] = useState('')
  if (templates.length === 0 && !canSave) return null
  const submit = () => { if (!name.trim()) return; onSave(name); setName(''); setNaming(false) }
  return (
    <section className="quote-templates" aria-label="Plantillas de cotización">
      <div className="quote-templates-head">
        <span className="eyebrow">Plantillas</span>
        {canSave && !naming && <button type="button" className="secondary-action" onClick={() => setNaming(true)}><BookmarkPlus size={14} /> Guardar esta cotización como plantilla</button>}
      </div>
      {naming && (
        <form className="quote-templates-form" onSubmit={(event) => { event.preventDefault(); submit() }}>
          <input autoFocus aria-label="Nombre de la plantilla" placeholder="Nombre (ej. Kit balde + resina)" value={name} maxLength={60} onChange={(event) => setName(event.target.value)} />
          <button type="submit" className="secondary-action" disabled={!name.trim()}>Guardar</button>
          <button type="button" className="secondary-action" onClick={() => { setNaming(false); setName('') }}>Cancelar</button>
        </form>
      )}
      {templates.length > 0 && (
        <ul>
          {templates.map((template) => (
            <li key={template.id}>
              <button type="button" className="quote-template-use" disabled={!ready} onClick={() => onUse(template)} title={template.items.map((item) => `${item.quantity} × ${item.name}`).join('\n')}>
                <strong>{template.name}</strong>
                <small>{template.items.length} producto{template.items.length === 1 ? '' : 's'} · usar</small>
              </button>
              <button type="button" className="quote-template-delete" aria-label={`Borrar la plantilla ${template.name}`} onClick={() => onDelete(template)}><Trash2 size={14} /></button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
