import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Save, X } from 'lucide-react'
import { api } from '../services/api'
import { useData } from '../hooks/useData'
import { useAuth } from '../context/auth'
import { draftKey, loadDraft, saveDraft, clearDraft } from '../hooks/drafts'
import { Heading, State } from './Common'
import { human } from '../utils/format'
import PasswordInput from './PasswordInput'

function SelectField({ field, value, onChange, currentLabel }) {
  const query = useData(field.endpoint, true)
  const options = field.endpoint
    ? (query.data || []).map((item) => [
        item.id,
        (item.name || item.title) +
          (item.date ? ' · ' + item.date + ' · ' + item.start.slice(0, 5) : ''),
      ])
    : field.choices.map((v) => [v, human(v)])
  if (
    value &&
    currentLabel &&
    !options.some(([id]) => String(id) === String(value))
  ) {
    options.unshift([value, currentLabel])
  }
  return (
    <>
      <select
        value={value ?? ''}
        disabled={Boolean(field.endpoint && !query.data)}
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

function AssignedTeams({ query, teams, selected, onChange }) {
  return (
    <fieldset className="full assignment-field">
      <legend>Assigned teams</legend>
      <small>Choose at least one team.</small>
      <State query={query}>
        {() => (
          <div className="assignment-options">
            {teams.map(({ id, name, is_active }) => (
              <label className="check" key={id}>
                <input
                  type="checkbox"
                  checked={selected.includes(id)}
                  onChange={(e) =>
                    onChange(
                      e.target.checked
                        ? [...selected, id]
                        : selected.filter((team) => team !== id),
                    )
                  }
                />
                {name + (is_active ? '' : ' (inactive)')}
              </label>
            ))}
          </div>
        )}
      </State>
    </fieldset>
  )
}

function Editor({ config: c, initial, id }) {
  const { user, adviser } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
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
    for (const field of fields) {
      if (field.type === 'datetime-local' && defaults[field.name])
        defaults[field.name] = defaults[field.name].slice(0, 16)
    }
    const draft = loadDraft(key)
    if (c.api === 'accounts' && draft.team && !draft.teams)
      draft.teams = [Number(draft.team)]
    return { ...defaults, ...draft }
  })
  const staffAccount = c.api === 'accounts' && values.role === 'staff'
  const teamOptions = useData(staffAccount ? 'teams/' : null, true)
  const activeTeams = teamOptions.data || []
  const teams = [
    ...activeTeams,
    ...(initial?.assigned_teams || [])
      .filter(({ id }) => !activeTeams.some((team) => team.id === id))
      .map((team) => ({ ...team, is_active: false })),
  ]
  const selectedTeams = (values.teams || []).filter((id) =>
    teams.some((team) => team.id === id),
  )
  const visibleFields = fields.filter((field) => {
    if (field.type === 'team-checkboxes') return staffAccount
    if (c.api === 'teams' && field.name === 'is_active')
      return !initial?.is_core
    if (c.api === 'venues' && field.name === 'available')
      return !initial?.archived
    return true
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const path = '/' + c.path
  const back =
    c.api === 'teams' && id
      ? path +
        (initial?.is_active
          ? '?team=' + id + '&page=1'
          : '/' + id + '?settings=1')
      : path + (id ? '/' + id : '')
  function change(name, value) {
    const next = { ...values, [name]: value }
    setValues(next)
    saveDraft(key, next, fields)
  }
  async function submit(e) {
    e.preventDefault()
    setError('')
    if (staffAccount && !selectedTeams.length) {
      setError('Choose at least one assigned team.')
      return
    }
    setBusy(true)
    const data = new FormData()
    for (const f of visibleFields) {
      if (f.type === 'team-checkboxes') continue
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
      let body = data
      if (c.api === 'accounts') {
        body = Object.fromEntries(data)
        const originalTeams = initial?.teams || []
        if (
          staffAccount &&
          (!id ||
            selectedTeams.length !== originalTeams.length ||
            selectedTeams.some((team) => !originalTeams.includes(team)))
        )
          body.teams = selectedTeams
      }
      const item = await api(c.api + '/' + (id ? id + '/' : '') + '?manage=1', {
        method: id ? 'PATCH' : 'POST',
        body,
      })
      clearDraft(key)
      const itemPath = path + '/' + item.id
      navigate(
        c.api === 'teams'
          ? item.is_active
            ? path + '?team=' + item.id + '&page=1'
            : itemPath + '?settings=1'
          : itemPath,
        {
          replace: true,
          state:
            c.api === 'reservations'
              ? {
                  notice:
                    item.status === 'approved'
                      ? 'Reservation automatically approved.'
                      : 'Reservation submitted for review.',
                }
              : undefined,
        },
      )
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
        {visibleFields.map((f) => {
          if (f.type === 'team-checkboxes')
            return (
              <AssignedTeams
                key={f.name}
                query={teamOptions}
                teams={teams}
                selected={selectedTeams}
                onChange={(value) => change(f.name, value)}
              />
            )
          const required =
            f.required || (c.api === 'accounts' && f.name === 'password' && !id)
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
                  currentLabel={
                    f.name === 'venue' &&
                    String(initial?.venue) === String(values.venue)
                      ? initial?.venue_name
                      : f.name === 'reservation' &&
                          String(initial?.reservation) ===
                            String(values.reservation)
                        ? initial?.venue_name
                        : undefined
                  }
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
              ) : f.type === 'password' ? (
                <>
                  <PasswordInput
                    label={f.label}
                    autoComplete="new-password"
                    autoFocus={params.get('password') === '1'}
                    required={required}
                    value={values[f.name] ?? ''}
                    onChange={(e) => change(f.name, e.target.value)}
                  />
                  <small>
                    {id
                      ? 'Leave blank to keep the current password.'
                      : 'The member will choose a permanent password at first sign-in.'}
                  </small>
                </>
              ) : (
                <input
                  type={f.type}
                  min={f.type === 'number' ? 1 : undefined}
                  autoComplete="off"
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
          <button
            className="primary"
            disabled={busy || (staffAccount && !teamOptions.data)}
          >
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
