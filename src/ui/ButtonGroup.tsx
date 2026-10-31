import type { ReactNode } from 'react'
import { Button } from './Button'
import './ButtonGroup.css'

type ButtonGroupProps<T extends string | number> = {
  label: string
  options: readonly { value: T; label: ReactNode }[]
  value: T | undefined
  onChange: (value: T) => void
  className?: string
}

export function ButtonGroup<T extends string | number>({
  label,
  options,
  value,
  onChange,
  className = '',
}: ButtonGroupProps<T>) {
  return (
    <div
      className={`button-group ${className}`}
      role="group"
      aria-label={label}
    >
      {options.map((option) => (
        <Button
          key={option.value}
          variant="ghost"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  )
}
