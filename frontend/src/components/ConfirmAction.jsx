import { useEffect, useRef } from 'react'

export default function ConfirmAction({
  title,
  children,
  cancel,
  confirm,
  label,
  busy,
  error,
}) {
  const dialog = useRef(null)
  useEffect(() => {
    dialog.current.showModal()
  }, [])
  return (
    <dialog
      ref={dialog}
      onCancel={(e) => {
        e.preventDefault()
        if (!busy) cancel()
      }}
      aria-labelledby="confirm-title"
    >
      <h3 id="confirm-title">{title}</h3>
      <p>{children}</p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="actions">
        <button type="button" onClick={cancel} disabled={busy} autoFocus>
          Cancel
        </button>
        <button
          type="button"
          className="danger"
          onClick={confirm}
          disabled={busy}
        >
          {busy ? 'Working…' : label}
        </button>
      </div>
    </dialog>
  )
}
