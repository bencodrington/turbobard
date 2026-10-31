import { FontAwesomeIconView } from './icons'
import './CombatToggle.css'

export function CombatToggle({
  label,
  checked,
  disabled = false,
  onChange,
}: {
  label: string
  checked: boolean
  disabled?: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className={`combat-toggle${disabled ? ' is-disabled' : ''}`}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="combat-switch" aria-hidden="true">
        <span className="combat-thumb">
          <FontAwesomeIconView iconId="hand-fist" />
        </span>
      </span>
      <span>{label}</span>
    </label>
  )
}
