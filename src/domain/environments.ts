import type { Environment } from './playback'

export function createEnvironment(
  id: string,
  name = 'Untitled Environment',
): Environment {
  return {
    id,
    name,
    volume: 1,
    sounds: [],
    playing: false,
    combatMode: false,
    expanded: true,
    icon: null,
    iconColor: null,
  }
}

export function renameEnvironment(
  environment: Environment,
  name: string,
): Environment {
  return { ...environment, name }
}

export function toggleEnvironmentExpanded(
  environment: Environment,
): Environment {
  return { ...environment, expanded: !environment.expanded }
}

export function deleteEnvironment(
  environments: Environment[],
  environmentId: string,
): Environment[] {
  return environments.filter((environment) => environment.id !== environmentId)
}

export function setEnvironmentIcon(
  environment: Environment,
  icon: string | null,
): Environment {
  return { ...environment, icon }
}

export function setEnvironmentIconColor(
  environment: Environment,
  iconColor: string | null,
): Environment {
  return { ...environment, iconColor }
}
