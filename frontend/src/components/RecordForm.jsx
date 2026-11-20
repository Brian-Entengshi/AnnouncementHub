import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Save, X } from 'lucide-react'
import { api } from '../services/api'
import { managePath } from '../services/catalog'
import { useData } from '../hooks/useData'
import { useAuth } from '../context/auth'
import { draftKey, loadDraft, saveDraft, clearDraft } from '../hooks/drafts'
import { Heading, State } from './Common'
import { human } from '../utils/format'

function SelectField({ field, value, onChange, disabled }) {
  const query = useData(field.endpoint, true)
  const options = field.endpoint
    ? (query.data || []).map((item) => [
        item.id,
        (item.name || item.title) +
          (item.date ? ' · ' + item.date + ' · ' + item.start.slice(0, 5) : ''),
      ])
    : field.choices.map((v) => [v, human(v)])
  return (
    <>
      <select
        value={value ?? ''}
        disabled={disabled}
        required={field.required}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Select…</option>
        {options.map(([v, label]) => (
          <option key={v} value={v}>
            {label}
          </option>
        ))}
      </select>
      {query.error && (
        <span role="alert">
          {query.error}{' '}
          <button type="button" onClick={query.reload}>
            Retry
          </button>
        </span>
      )}
    </>
  )
}
function Editor({ config: c, initial, id }) {
  const { user, adviser } = useAuth()
  const navigate = useNavigate()
  const key = draftKey(user.id, c.api + '/' + (id || 'new'))
  let fields = c.fields
  if (c.api === 'accounts')
    fields = fields.map((f) =>
      f.name === 'role'
        ? {
            ...f,
            choices:
              initial?.role === 'adviser'
                ? ['adviser']
                : adviser
                  ? ['staff', 'officer']
                  : ['staff'],
          }
        : f,
    )
  const [values, setValues] = useState(() => {
    const defaults = {
      is_active: true,
      available: true,
      status: 'draft',
      role: 'staff',
      ...initial,
    }
    if (user.role === 'staff') defaults.team = user.team
    for (const field of fields) {
      if (field.type === 'datetime-local' && defaults[field.name])
        defaults[field.name] = defaults[field.name].slice(0, 16)
    }
    return { ...defaults, ...loadDraft(key) }
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const back = '/' + managePath(c) + (id ? '/' + id : '')
  function change(name, value) {
    const next = { ...values, [name]: value }
    setValues(next)
    saveDraft(key, next, fields)
  }
  async function submit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    const data = new FormData()
    for (const f of fields) {
      const v = values[f.name]
      if (f.type === 'file') {
        if (v instanceof File) data.append(f.name, v)
        continue
      }
      if (f.type === 'password' && !v) continue
      data.append(
        f.name,
        f.type === 'checkbox'
          ? String(Boolean(v))
          : f.type === 'datetime-local' && v
            ? v + '+08:00'
            : (v ?? ''),
      )
    }
    try {
      const item = await api(c.api + '/' + (id ? id + '/' : '') + '?manage=1', {
        method: id ? 'PATCH' : 'POST',
        body: data,
      })
      clearDraft(key)
      navigate('/' + managePath(c) + '/' + item.id, { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <Heading
        kicker={c.group}
        title={(id ? 'Edit ' : 'New ') + c.singular.toLowerCase()}
      />
      <form className="panel form" onSubmit={submit}>
        {c.api === 'reservations' && (
          <p className="full">
            Requested by <strong>{user.full_name || user.username}</strong>. All
            booking times are in Manila.
          </p>
        )}
        {fields.map((f) => {
          const required =
            f.required ||
            (c.api === 'accounts' &&
              ((f.name === 'password' && !id) ||
                (f.name === 'team' && values.role === 'staff')))
          return (
            <label
              className={
                ['textarea', 'file', 'checkbox'].includes(f.type) ? 'full' : ''
              }
              key={f.name}
            >
              {f.type !== 'checkbox' && (
                <span>
                  {f.label}
                  {required && ' *'}
                </span>
              )}
              {f.type === 'select' ? (
                <SelectField
                  field={{ ...f, required }}
                  value={values[f.name]}
                  disabled={user.role === 'staff' && f.name === 'team'}
                  onChange={(v) => change(f.name, v)}
                />
              ) : f.type === 'textarea' ? (
                <textarea
                  required={required}
                  value={values[f.name] || ''}
                  onChange={(e) => change(f.name, e.target.value)}
                />
              ) : f.type === 'checkbox' ? (
                <span className="check">
                  <input
                    type="checkbox"
                    checked={Boolean(values[f.name])}
                    onChange={(e) => change(f.name, e.target.checked)}
                  />
                  {f.label}
                </span>
              ) : f.type === 'file' ? (
                <>
                  <input
                    type="file"
                    accept={f.accept}
                    onChange={(e) => change(f.name, e.target.files[0])}
                  />
                  <small>Reselect files after refreshing.</small>
                </>
              ) : (
                <input
                  type={f.type}
                  min={f.type === 'number' ? 1 : undefined}
                  autoComplete={f.type === 'password' ? 'new-password' : 'off'}
                  required={required}
                  value={values[f.name] ?? ''}
                  onChange={(e) => change(f.name, e.target.value)}
                />
              )}
            </label>
          )
        })}
        {error && (
          <div role="alert" className="error full">
            {error}
          </div>
        )}
        <div className="actions full">
          <button className="primary" disabled={busy}>
            <Save size={16} />
            {busy ? 'Saving…' : 'Save ' + c.singular.toLowerCase()}
          </button>
          <button
            type="button"
            onClick={() => {
              clearDraft(key)
              navigate(back)
            }}
          >
            <X size={16} />
            Cancel
          </button>
        </div>
      </form>
    </>
  )
}
export default function RecordForm({ config, id }) {
  const query = useData(id ? config.api + '/' + id + '/?manage=1' : null)
  return id ? (
    <State query={query}>
      {(item) => (
        <Editor key={config.api + id} config={config} initial={item} id={id} />
      )}
    </State>
  ) : (
    <Editor key={config.api} config={config} />
  )
}
