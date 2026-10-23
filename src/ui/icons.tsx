import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { fas } from '@fortawesome/free-solid-svg-icons'

const ICON_ALIASES: Record<string, string> = {
  campfire: 'fire',
}

function iconDefinitionFor(iconId: string): IconDefinition | undefined {
  const resolvedId = ICON_ALIASES[iconId] ?? iconId
  const key = `fa${resolvedId
    .split('-')
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join('')}`
  return fas[key]
}

export function FontAwesomeIconView({
  iconId,
  className,
}: {
  iconId: string
  className?: string
}) {
  const definition = iconDefinitionFor(iconId)

  if (!definition) {
    if (import.meta.env.DEV) {
      console.warn(`Font Awesome icon is unavailable: ${iconId}`)
    }
    return (
      <span
        className={className ? `${className} icon-fallback` : 'icon-fallback'}
        data-icon={iconId}
        aria-hidden="true"
      >
        ✦
      </span>
    )
  }

  return (
    <FontAwesomeIcon
      icon={definition}
      className={className}
      data-icon={iconId}
      aria-hidden="true"
    />
  )
}
