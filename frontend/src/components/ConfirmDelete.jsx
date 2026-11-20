import { useEffect, useRef } from 'react'

export default function ConfirmDelete({ name, cancel, confirm, busy }) {
  const dialog = useRef(null)
  useEffect(() => {
    dialog.current.showModal()
  }, [])
  return (
    <dialog ref={dialog} onCancel={cancel} aria-labelledby="confirm-title">
      <h3 id="confirm-title">Delete this {name}?</h3>
      <p>This will remove the record permanently.</p>
      <div className="actions">
        <button onClick={cancel} disabled={busy} autoFocus>
          Keep record
        </button>
        <button className="danger" onClick={confirm} disabled={busy}>
          Confirm deletion
        </button>
      </div>
    </dialog>
  )
}
