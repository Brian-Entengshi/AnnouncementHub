import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowUpRight,
  CheckCircle2,
  Eye,
  House,
  Info,
  Mail,
  Megaphone,
} from 'lucide-react'
import { api } from '../services/api'
import {
  PublicHomeSection,
  PublicAboutSection,
  PublicContactsSection,
} from './StudentSections'

const sections = [
  {
    key: 'home',
    label: 'Home',
    icon: House,
    description: 'Set the text, image, and primary action students see first.',
    fields: [
      {
        name: 'hero_heading',
        label: 'Hero heading',
        maxLength: 120,
        required: true,
        full: true,
      },
      {
        name: 'hero_welcome',
        label: 'Welcome message',
        maxLength: 120,
        full: true,
        hint: 'Short text above the heading.',
      },
      {
        name: 'hero_description',
        label: 'Hero description',
        maxLength: 600,
        type: 'textarea',
      },
      {
        name: 'hero_cta_label',
        label: 'Primary action text',
        maxLength: 60,
        required: true,
      },
      {
        name: 'hero_cta_section',
        label: 'Primary action destination',
        options: [
          ['events', 'Club Events'],
          ['about', 'About'],
          ['announcements', 'Announcements'],
          ['contacts', 'Contacts'],
        ],
      },
      {
        name: 'hero_image_alt',
        label: 'Hero image description',
        maxLength: 160,
        full: true,
        hint: 'Describe the image briefly if it conveys information.',
      },
    ],
  },
  {
    key: 'about',
    label: 'About',
    icon: Info,
    description:
      'Introduce DLL Elite and publish its approved purpose, mission, and vision.',
    fields: [
      {
        name: 'about_heading',
        label: 'About heading',
        maxLength: 120,
        required: true,
        full: true,
      },
      {
        name: 'about_intro',
        label: 'Organization introduction',
        maxLength: 300,
        type: 'textarea',
      },
      {
        name: 'about_description',
        label: 'Organization description',
        maxLength: 1200,
        type: 'textarea',
      },
      {
        name: 'about_purpose',
        label: 'Purpose or objectives',
        maxLength: 600,
        type: 'textarea',
      },
      {
        name: 'about_mission',
        label: 'Mission',
        maxLength: 600,
        type: 'textarea',
        half: true,
      },
      {
        name: 'about_vision',
        label: 'Vision',
        maxLength: 600,
        type: 'textarea',
        half: true,
      },
    ],
  },
  {
    key: 'announcements',
    label: 'Announcements',
    icon: Megaphone,
    description:
      'Set how published announcements appear on Student Access. Write and pin announcements in the Announcements workspace.',
    fields: [
      {
        name: 'highlight_pinned',
        label: 'Highlight pinned announcement',
        type: 'checkbox',
      },
      {
        name: 'announcement_page_size',
        label: 'Announcements per page',
        required: true,
        type: 'number',
        min: 1,
        max: 12,
      },
    ],
  },
  {
    key: 'contacts',
    label: 'Contacts',
    icon: Mail,
    description:
      'Add approved organization contact channels. Empty contact fields are skipped on the public page.',
    fields: [
      {
        name: 'contact_heading',
        label: 'Contact heading',
        maxLength: 120,
        required: true,
        full: true,
      },
      {
        name: 'contact_intro',
        label: 'Contact introduction',
        maxLength: 300,
        type: 'textarea',
      },
      {
        name: 'contact_email',
        label: 'Contact email',
        type: 'email',
        maxLength: 254,
      },
      {
        name: 'contact_phone',
        label: 'Public phone number',
        type: 'tel',
        maxLength: 40,
      },
      { name: 'office_location', label: 'Office location', maxLength: 200 },
      { name: 'office_hours', label: 'Office hours', maxLength: 160 },
      { name: 'facebook_url', label: 'Facebook URL', type: 'url' },
      { name: 'instagram_url', label: 'Instagram URL', type: 'url' },
      { name: 'website_url', label: 'Website URL', type: 'url' },
    ],
  },
]

const imageTypes = ['image/jpeg', 'image/png', 'image/webp']

function ContentField({ field, value, change }) {
  const {
    name,
    label,
    type,
    options,
    maxLength,
    required,
    hint,
    full,
    half,
    min,
    max,
  } = field
  if (type === 'checkbox') {
    return (
      <label className="check full">
        <input
          type="checkbox"
          name={name}
          checked={Boolean(value)}
          onChange={(event) => change(name, event.target.checked)}
        />
        {label}
      </label>
    )
  }
  const hintId = hint ? 'landing-hint-' + name : undefined
  const input = {
    name,
    value: value ?? '',
    required,
    'aria-describedby': hintId,
    onChange: (event) => {
      const next = event.target.value
      change(
        name,
        type === 'number' && next !== '' ? event.target.valueAsNumber : next,
      )
    },
  }
  return (
    <div
      className={full || (type === 'textarea' && !half) ? 'full' : undefined}
    >
      <label>
        <span>
          {label}
          {required && <span aria-hidden="true"> *</span>}
        </span>
        {options ? (
          <select {...input}>
            {options.map(([key, title]) => (
              <option key={key} value={key}>
                {title}
              </option>
            ))}
          </select>
        ) : type === 'textarea' ? (
          <textarea {...input} maxLength={maxLength} />
        ) : (
          <input
            {...input}
            type={type || 'text'}
            maxLength={maxLength}
            min={min}
            max={max}
          />
        )}
      </label>
      {hint && (
        <small id={hintId} className="landing-field-hint">
          {hint}
        </small>
      )}
    </div>
  )
}

function SectionPreview({ section, content }) {
  const Entry = {
    home: PublicHomeSection,
    about: PublicAboutSection,
    contacts: PublicContactsSection,
  }[section]
  return (
    <aside
      className="landing-preview panel"
      aria-labelledby="landing-preview-heading"
    >
      <header>
        <h3 id="landing-preview-heading">
          <Eye size={17} aria-hidden="true" /> Draft preview
        </h3>
      </header>
      {Entry ? (
        <div className="public-site landing-preview-site">
          <Entry content={content} preview />
        </div>
      ) : (
        <div className="landing-display-preview">
          <dl>
            <div>
              <dt>Announcements per page</dt>
              <dd>{content.announcement_page_size || '—'}</dd>
            </div>
            <div>
              <dt>Pinned announcement highlight</dt>
              <dd>{content.highlight_pinned ? 'On' : 'Off'}</dd>
            </div>
          </dl>
          <Link className="button" to="/announcements">
            Manage announcements <ArrowUpRight size={15} />
          </Link>
        </div>
      )}
    </aside>
  )
}

export default function LandingPageEditor({ initial }) {
  const [index, setIndex] = useState(0)
  const [current, setCurrent] = useState(initial)
  const [draft, setDraft] = useState(initial)
  const [upload, setUpload] = useState(null)
  const [message, setMessage] = useState(null)
  const [imageError, setImageError] = useState('')
  const [saving, setSaving] = useState(false)
  const imageInput = useRef(null)
  const section = sections[index]
  const changes = Object.fromEntries(
    Object.entries(draft).filter(([field, value]) => value !== current[field]),
  )
  const dirty = Boolean(upload || Object.keys(changes).length)

  useEffect(
    () => () => {
      if (upload) URL.revokeObjectURL(upload.url)
    },
    [upload],
  )

  function update(field, value) {
    setDraft((previous) => ({ ...previous, [field]: value }))
    setMessage(null)
  }

  function chooseImage(event) {
    const file = event.target.files[0]
    if (!file) return
    setMessage(null)
    if (
      (file.type && !imageTypes.includes(file.type)) ||
      file.size > 5 * 1024 * 1024
    ) {
      setImageError('Choose a JPEG, PNG, or WebP image up to 5 MB.')
      setUpload(null)
      event.target.value = ''
      return
    }
    setImageError('')
    setUpload({ file, url: URL.createObjectURL(file) })
  }

  function keepDefaultImage() {
    setUpload(null)
    if (imageInput.current) imageInput.current.value = ''
    setImageError('')
    setMessage(null)
    setDraft((previous) => ({
      ...previous,
      hero_image: null,
      hero_image_alt: '',
    }))
  }

  function resetDraft(settings) {
    setDraft(settings)
    setUpload(null)
    setImageError('')
    if (imageInput.current) imageInput.current.value = ''
  }

  async function publish(event) {
    event.preventDefault()
    setMessage(null)
    setSaving(true)
    let body = changes
    if (upload) {
      body = new FormData()
      for (const [field, value] of Object.entries(changes)) {
        if (field !== 'hero_image') body.set(field, value)
      }
      body.set('hero_image', upload.file)
    }
    try {
      const updated = await api('settings/', { method: 'PATCH', body })
      setCurrent(updated)
      resetDraft(updated)
      setMessage({ text: 'Changes published to Student Access.' })
    } catch (error) {
      setMessage({ text: error.message, error: true })
    } finally {
      setSaving(false)
    }
  }

  function handleTabKey(event) {
    const indices = {
      ArrowLeft: (index + sections.length - 1) % sections.length,
      ArrowRight: (index + 1) % sections.length,
      Home: 0,
      End: sections.length - 1,
    }
    if (!(event.key in indices)) return
    event.preventDefault()
    const next = indices[event.key]
    setIndex(next)
    event.currentTarget.children[next]?.focus()
  }

  return (
    <section
      className="panel landing-manager"
      aria-labelledby="landing-manager-heading"
    >
      <header className="landing-manager-heading">
        <div>
          <h2 id="landing-manager-heading">Landing Page Management</h2>
          <p>Preview your edits here, then publish them to Student Access.</p>
        </div>
        <Link
          className="button"
          to="/student"
          target="_blank"
          rel="noopener noreferrer"
        >
          View Student Access <ArrowUpRight size={16} />
        </Link>
      </header>

      <div
        className="landing-manager-tabs"
        role="tablist"
        aria-label="Landing page sections"
        onKeyDown={handleTabKey}
      >
        {sections.map(({ key, label, icon: Icon }, position) => (
          <button
            key={key}
            id={'landing-tab-' + key}
            type="button"
            role="tab"
            aria-selected={position === index}
            aria-controls="landing-editor-panel"
            tabIndex={position === index ? 0 : -1}
            onClick={() => setIndex(position)}
          >
            <Icon size={16} aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>

      <div
        className="landing-editor-layout"
        id="landing-editor-panel"
        role="tabpanel"
        aria-labelledby={'landing-tab-' + section.key}
      >
        <form className="form landing-editor-form" onSubmit={publish}>
          <div className="landing-editor-heading full">
            <h3>{section.label} settings</h3>
            <p>{section.description}</p>
          </div>
          <fieldset disabled={saving} className="landing-editor-fields full">
            {section.fields.map((field) => (
              <ContentField
                key={field.name}
                field={field}
                value={draft[field.name]}
                change={update}
              />
            ))}
            {section.key === 'home' && (
              <div className="landing-image-field full">
                <label>
                  <span>Hero image</span>
                  <input
                    ref={imageInput}
                    name="hero_image"
                    type="file"
                    accept={imageTypes.join(',')}
                    onChange={chooseImage}
                    aria-describedby="landing-image-restrictions"
                  />
                </label>
                <small id="landing-image-restrictions">
                  JPEG, PNG, or WebP, up to 5 MB.
                </small>
                {upload && <small>Selected image: {upload.file.name}</small>}
                {(draft.hero_image || upload) && (
                  <button type="button" onClick={keepDefaultImage}>
                    Use default image
                  </button>
                )}
                {imageError && (
                  <>
                    <p className="error" role="alert">
                      {imageError}
                    </p>
                    <button type="button" onClick={() => setImageError('')}>
                      Dismiss file error
                    </button>
                  </>
                )}
              </div>
            )}
          </fieldset>
          <div className="landing-editor-feedback full">
            {message && (
              <p
                className={message.error ? 'error' : 'landing-published'}
                role={message.error ? 'alert' : 'status'}
              >
                {!message.error && (
                  <CheckCircle2 size={18} aria-hidden="true" />
                )}
                {message.text}
              </p>
            )}
            <div className="actions">
              <button
                type="submit"
                className="primary"
                disabled={!dirty || saving || Boolean(imageError)}
              >
                {saving ? 'Publishing…' : 'Save and publish'}
              </button>
              {dirty && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => {
                    resetDraft(current)
                    setMessage(null)
                  }}
                >
                  Discard changes
                </button>
              )}
            </div>
          </div>
        </form>
        <SectionPreview
          section={section.key}
          content={{ ...draft, hero_image: upload?.url ?? draft.hero_image }}
        />
      </div>
    </section>
  )
}
