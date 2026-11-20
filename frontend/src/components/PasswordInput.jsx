import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

export default function PasswordInput({ label, required, ...props }) {
  const [visible, setVisible] = useState(false)
  const Icon = visible ? EyeOff : Eye
  return (
    <div className="password-input">
      <input
        {...props}
        aria-label={label}
        required={required}
        type={visible ? 'text' : 'password'}
      />
      <button
        type="button"
        aria-label={(visible ? 'Hide ' : 'Show ') + label.toLowerCase()}
        onClick={() => setVisible((shown) => !shown)}
      >
        <Icon size={18} aria-hidden="true" />
      </button>
    </div>
  )
}
