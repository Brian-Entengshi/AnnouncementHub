import { useEffect, useRef } from 'react'

export default function ConfirmDelete({ name, cancel, confirm }) {
  const dialog = useRef(null)
  useEffect(() => {
    dialog.current.showModal()
  }, [])
  return (
    <dialog ref={dialog} onCancel={cancel} aria-labelledby="confirm-title">
      <h3 id="confirm-title">Delete this {name}?</h3>
      <p>This will remove the record permanently.</p>
      <div className="actions">
        <button onClick={cancel} autoFocus>
          Keep record
        </button>
        <button className="danger" onClick={confirm}>
          Confirm deletion
        </button>
      </div>
    </dialog>
  )
}
