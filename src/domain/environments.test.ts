import { describe, expect, it } from 'vitest'
import {
  createEnvironment,
  deleteEnvironment,
  renameEnvironment,
  setEnvironmentIcon,
  setEnvironmentIconColor,
} from './environments'

describe('Environment management', () => {
  it('creates an empty Environment ready for editing', () => {
    expect(createEnvironment('forest', 'Whispering Forest')).toEqual({
      id: 'forest',
      name: 'Whispering Forest',
      volume: 1,
      sounds: [],
      playing: false,
      combatMode: false,
      icon: null,
      iconColor: null,
    })
  })

  it('renames and deletes an Environment without changing other state', () => {
    const environment = createEnvironment('forest', 'Forest')
    const renamed = renameEnvironment(environment, 'Ruined Keep')
    expect(renamed).toEqual({ ...environment, name: 'Ruined Keep' })
    expect(
      deleteEnvironment([renamed, createEnvironment('cave', 'Cave')], 'forest'),
    ).toEqual([createEnvironment('cave', 'Cave')])
  })

  it('updates environment icon and color without mutating existing properties', () => {
    const environment = createEnvironment('forest', 'Forest')
    const withIcon = setEnvironmentIcon(environment, 'fire')
    const withColor = setEnvironmentIconColor(withIcon, '#F87C7C')

    expect(withIcon.icon).toBe('fire')
    expect(withIcon.iconColor).toBeNull()
    expect(withColor.icon).toBe('fire')
    expect(withColor.iconColor).toBe('#F87C7C')
    expect(environment.icon).toBeNull()
  })
})
