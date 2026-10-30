import type { ChangeEvent, InputHTMLAttributes, ReactNode } from 'react'
import { selectAllTextOnFocus } from './selectAllTextOnFocus'

type CommonFieldProps = {
  label: ReactNode
  value: string | number
  onChange: (event: ChangeEvent<HTMLInputElement>) => void
  inputProps?: Omit<
    InputHTMLAttributes<HTMLInputElement>,
    'type' | 'value' | 'onChange'
  >
  className?: string
}

export type LabeledRangeFieldProps = CommonFieldProps
export type LabeledNumberFieldProps = CommonFieldProps

export function LabeledRangeField({
  label,
  value,
  onChange,
  inputProps,
  className,
}: LabeledRangeFieldProps) {
  const input = (
    <input {...inputProps} type="range" value={value} onChange={onChange} />
  )

  if (label == null) return input

  return (
    <label className={className}>
      {label}
      {input}
    </label>
  )
}

export function LabeledNumberField({
  label,
  value,
  onChange,
  inputProps,
  className,
}: LabeledNumberFieldProps) {
  const input = (
    <input
      {...inputProps}
      type="number"
      value={value}
      onFocus={selectAllTextOnFocus}
      onChange={onChange}
    />
  )

  return (
    <label className={className}>
      {label}
      {input}
    </label>
  )
}
