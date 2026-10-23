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
