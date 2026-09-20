"use client"

import { useState, type ChangeEventHandler, type KeyboardEvent } from "react"
import { Eye, EyeOff } from "lucide-react"
import { Input } from "./input"

interface PasswordFieldProps {
  id: string
  label: string
  value: string
  onChange: ChangeEventHandler<HTMLInputElement>
  autoComplete: "current-password" | "new-password"
  required?: boolean
}

export function PasswordField({ id, label, value, onChange, autoComplete, required }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false)
  const [capsLock, setCapsLock] = useState(false)
  const warningId = `${id}-caps-lock`

  const updateCapsLock = (event: KeyboardEvent<HTMLInputElement>) => {
    setCapsLock(event.getModifierState("CapsLock"))
  }

  return (
    <>
      <div className="relative">
        <Input
          id={id}
          name={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={onChange}
          autoComplete={autoComplete}
          required={required}
          className="pr-12"
          onKeyDown={updateCapsLock}
          onKeyUp={updateCapsLock}
          onBlur={() => setCapsLock(false)}
          aria-describedby={capsLock ? warningId : undefined}
        />
        <button
          type="button"
          className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center rounded-xl text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`${visible ? "Hide" : "Show"} ${label}`}
          aria-pressed={visible}
          aria-controls={id}
          onClick={() => setVisible((current) => !current)}
        >
          {visible ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
        </button>
      </div>
      <p id={warningId} role="status" className="mt-1 text-xs text-muted-foreground">
        {capsLock ? "Caps Lock is on" : ""}
      </p>
    </>
  )
}
