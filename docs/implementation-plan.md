# Turbobard rebuild implementation plan

## Goal and constraints

Rebuild the `redesign-may-2024` application with the current Vite/React/TypeScript foundation, preserving the legacy user workflow and styling initially while improving startup speed, architecture, and testability. The first parity release targets modern desktop and mobile touch browsers. Native packaging, account sync, PWA capabilities, and Firebase implementation remain out of scope.

The external sound catalog and icon catalog are assumed to be running services. This repository owns their client contracts, not their backend implementations.

## Architecture target

1. Domain core: pure environment state, sound placement, Combat mode, transition decisions, one-shot scheduling, and migration rules.
2. Ports: `SoundCatalog`, `IconCatalog`, persistence, clock, random source, and audio port.
3. Adapters: local storage, external catalog clients, and browser audio implementation.
4. React UI: environment list/editor, search, now-playing banner, and controls that dispatch domain actions.
5. Verification: pure tests first, component/adapter tests second, and focused Playwright workflows for browser behavior.

The audio port must support loop playback, one-shot variation playback, volume, fade, stop, unload, and manual one-shot playback. The domain must not import Howler or browser audio APIs.

## Vertical slices

### 0. Capture the legacy contract

- Add characterization tests for environment transitions, Combat rules, local-storage loading, one-shot scheduling/randomness, loop lifecycle, and manual one-shot playback.
- Build fixtures for legacy environment JSON, sound catalog results, icon results, and failed remote sound metadata.
- Record any behavior that differs from the desired product language as an explicit follow-up decision.

Done when the inventory in `docs/legacy-behavior-inventory.md` has executable coverage for its high-risk behaviors.

### 1. Establish the domain model

- Introduce `Environment`, `Sound`, `Loop`, `OneShot`, `Ambiance`, `Combat`, and `CombatMode` types.
- Replace legacy split arrays with sound placement and derived playback selection.
- Implement pure actions for create, rename, remove, add, remove, volume changes, Combat transitions, and selecting the active environment.
- Inject clock and randomness into one-shot scheduling.

Done when domain tests cover normal playback, Combat playback, replacing an active environment, stopping, and edge cases such as empty or unavailable sounds.

### 2. Preserve user data

- Implement a versioned persistence adapter.
- Read the legacy `groups` key and migrate it into the new environment format.
- Normalize missing legacy fields and force restored playback to stopped/not-loaded.
- Write only the new versioned format after successful migration.

Done when real legacy fixtures round-trip without losing environment names, sounds, placements, volumes, icons, colors, or one-shot timing.

### 3. Define external catalog contracts

- Define `SoundCatalog.search`, `SoundCatalog.getSound`, and the metadata needed to resolve playable sources.
- Define `IconCatalog.search` and the icon identity/preview data needed by the editor.
- Provide deterministic fixtures and fake adapters for local development and tests.
- Add loading, empty, retry, and unavailable-item states; catalog failure must not stop already-playing environments.

Done when UI tests run without Firebase or an icon provider and contract tests document the expected external responses.

### 4. Implement the playback coordinator

- Implement environment transition planning separately from audio execution.
- Add the browser audio adapter, initially retaining Howler-equivalent behavior and the iOS unlock workaround where required.
- Preserve two-second loop fades, deferred loading, randomized one-shot intervals, separate manual one-shot instances, volume multiplication, and cleanup/unload.
- Surface per-sound failures without taking down the rest of the environment.

Done when fake-audio tests prove the command sequence and focused browser tests prove the adapter can play, fade, stop, and recover across supported browsers.

### 5. Rebuild the editing and playback UI

- Port the existing styling and responsive layout.
- Rebuild environment list/editor, search filters, add/remove flows, pack expansion, source details, icon search, icon color, volume controls, timing controls, Play now, and the now-playing banner.
- Preserve keyboard Escape behavior and mobile touch flows.
- Keep initial render and restored environments free from eager audio construction.

Done when the full legacy editing surface is covered by component tests and the main workflows pass in Playwright.

### 6. Hardening and release parity

- Run formatting, linting, typechecking, unit tests, build, and Chromium/Firefox/WebKit browser tests in CI.
- Compare the rebuild manually against the legacy styling and workflows.
- Measure dev startup and focused test duration; add budgets once the new baseline is available.
- Document intentional differences and defer all future ideas to the backlog.

Done when `npm run verify` is reliable and the parity checklist is signed off.

## Feature-parity checklist

- [ ] Environment creation, naming, deletion, expansion, icons, colors, and volume
- [ ] Sound and pack search with Everything/Music/Ambiance filters
- [ ] Add/remove sounds and choose ordinary or Combat placement
- [ ] Loop playback, smooth looping, volume, and two-second fades
- [ ] One-shot variation selection, timing range, timer state, and Play now
- [ ] Environment transitions and now-playing banner
- [ ] Combat mode music replacement and ambiance layering
- [ ] Legacy local-storage migration
- [ ] Catalog and audio failure isolation
- [ ] Responsive desktop/mobile styling and browser verification
