import type { ComponentPropsWithRef } from 'react'

export type ButtonProps = ComponentPropsWithRef<'button'> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'text'
  iconOnly?: boolean
  danger?: boolean
}

export function Button({
  variant = 'secondary',
  iconOnly = false,
  danger = false,
  type = 'button',
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      type={type}
      className={[
        'button',
        `button--${variant}`,
        iconOnly && 'button--icon-only',
        danger && 'button--danger',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    />
  )
}
