import { useMemo, useState } from 'react'
import {
  createEnvironment,
  deleteEnvironment,
  renameEnvironment,
  toggleEnvironmentExpanded,
} from './domain/environments'
import type { Environment } from './domain/playback'
import { createEnvironmentPersistence } from './persistence/environments'

function newEnvironmentId(): string {
  return typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `environment-${Date.now()}`
}

export default function App() {
  const persistence = useMemo(
    () => createEnvironmentPersistence(window.localStorage),
    [],
  )
  const [environments, setEnvironments] = useState<Environment[]>(() =>
    persistence.load(),
  )
  const [selectedId, setSelectedId] = useState<string | undefined>(
    () => environments[0]?.id,
  )

  const updateEnvironments = (next: Environment[]) => {
    setEnvironments(next)
    persistence.save(next)
  }

  const addEnvironment = () => {
    const environment = createEnvironment(newEnvironmentId(), 'New Environment')
    updateEnvironments([...environments, environment])
    setSelectedId(environment.id)
  }

  const renameEnvironmentInState = (environment: Environment, name: string) => {
    updateEnvironments(
      environments.map((item) =>
        item.id === environment.id ? renameEnvironment(item, name) : item,
      ),
    )
  }

  const removeEnvironment = (environmentId: string) => {
    const next = deleteEnvironment(environments, environmentId)
    updateEnvironments(next)
    if (selectedId === environmentId) setSelectedId(next[0]?.id)
  }

  const toggleExpanded = (environment: Environment) => {
    updateEnvironments(
      environments.map((item) =>
        item.id === environment.id ? toggleEnvironmentExpanded(item) : item,
      ),
    )
  }

  return (
    <main className="app-shell">
      <section className="workspace" aria-labelledby="app-title">
        <div className="workspace-header">
          <div>
            <p className="eyebrow">Cross-platform audio workspace</p>
            <h1 id="app-title">Turbobard</h1>
            <p className="intro">
              Create and manage Environments for every tabletop scene.
            </p>
          </div>
          <button className="primary-button" onClick={addEnvironment}>
            Create Environment
          </button>
        </div>
        <div className="status-card" role="status" aria-live="polite">
          <span className="status-dot" aria-hidden="true" />
          <span>
            Ready for the first listening session. {environments.length}{' '}
            {environments.length === 1 ? 'Environment' : 'Environments'} saved.
          </span>
        </div>
        <section
          aria-labelledby="environments-heading"
          className="environment-panel"
        >
          <div className="section-heading">
            <h2 id="environments-heading">Environments</h2>
            <span>{environments.length}</span>
          </div>
          {environments.length === 0 ? (
            <p className="empty-state">
              No Environments yet. Create one to start building a scene.
            </p>
          ) : (
            <div className="environment-list" role="list">
              {environments.map((environment) => {
                const selected = selectedId === environment.id
                return (
                  <article
                    className={`environment-card${selected ? ' selected' : ''}`}
                    key={environment.id}
                    role="listitem"
                  >
                    <div className="environment-card-header">
                      <label
                        className="sr-only"
                        htmlFor={`name-${environment.id}`}
                      >
                        Environment name
                      </label>
                      <input
                        id={`name-${environment.id}`}
                        value={environment.name}
                        onChange={(event) =>
                          renameEnvironmentInState(
                            environment,
                            event.target.value,
                          )
                        }
                      />
                      <button
                        aria-pressed={selected}
                        className="secondary-button"
                        onClick={() => setSelectedId(environment.id)}
                      >
                        {selected ? 'Selected' : 'Select'}
                      </button>
                    </div>
                    <div className="environment-actions">
                      <button
                        aria-expanded={environment.expanded}
                        className="text-button"
                        onClick={() => toggleExpanded(environment)}
                      >
                        {environment.expanded ? 'Collapse' : 'Expand'}
                      </button>
                      <button
                        className="text-button danger-button"
                        onClick={() => removeEnvironment(environment.id)}
                      >
                        Delete
                      </button>
                    </div>
                    {environment.expanded && (
                      <p className="environment-details">
                        Ready for Sounds. Select this Environment to edit its
                        scene.
                      </p>
                    )}
                  </article>
                )
              })}
            </div>
          )}
        </section>
      </section>
    </main>
  )
}
