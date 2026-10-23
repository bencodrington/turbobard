# Environment playback parity rebuild

## Problem Statement

The current Turbobard rebuild is only a modern frontend scaffold. The legacy application already supports tabletop RPG audio workflows, but its Create React App architecture, tightly coupled Redux/Howler implementation, sparse automated coverage, and external-service assumptions make startup slow and feature work risky. Users need the existing Environment, Sound, Loop, One-shot, and Combat mode workflow to remain dependable while the application is rebuilt on the faster Vite/React/TypeScript foundation.

## Solution

Rebuild the legacy application as a testable browser application that preserves the full user-visible editing and playback workflow, initially preserving the existing styling and browser local data. Model Environment and playback decisions as pure domain behavior behind replaceable ports for browser audio, persistence, the external Sound catalog, and the external Icon catalog. Migrate legacy local environments, retain legacy audio semantics unless an intentional change is documented, and use TDD vertical slices to establish behavior before replacing infrastructure.

## User Stories

1. As a tabletop GM, I want to create an Environment, so that I can prepare audio for a scene.
2. As a tabletop GM, I want to rename an Environment, so that I can recognize it during play.
3. As a tabletop GM, I want to delete an Environment, so that I can remove scenes I no longer need.
4. As a tabletop GM, I want to expand or collapse an Environment, so that I can manage a large collection of scenes.
5. As a tabletop GM, I want to select an icon and color for an Environment, so that I can identify it quickly.
6. As a tabletop GM, I want to search the Sound catalog, so that I can find appropriate music and effects.
7. As a tabletop GM, I want to filter search results by Everything, Music, or Ambiance, so that I can narrow the available Sounds.
8. As a tabletop GM, I want to add an individual Sound to an Environment, so that I can compose a scene precisely.
9. As a tabletop GM, I want to add a pack of Sounds to an Environment, so that I can build a scene quickly.
10. As a tabletop GM, I want to place a Sound in Ambiance or Combat, so that the Sound participates in the intended playback mode.
11. As a tabletop GM, I want to remove a Sound from an Environment, so that I can refine the scene.
12. As a tabletop GM, I want to see Sound source information, so that I can understand attribution and provenance.
13. As a tabletop GM, I want to adjust Environment volume, so that I can control the overall scene level.
14. As a tabletop GM, I want to adjust individual Sound volume, so that I can balance music and effects.
15. As a tabletop GM, I want to play an Environment with one action, so that I can react quickly during a game.
16. As a tabletop GM, I want starting one Environment to stop the previously active Environment, so that scenes do not unintentionally overlap.
17. As a tabletop GM, I want Loop Sounds to repeat smoothly, so that ongoing music and ambiance do not stop.
18. As a tabletop GM, I want Environment transitions to fade Sounds over two seconds, so that changes do not sound abrupt.
19. As a tabletop GM, I want Loop loading to be deferred until needed, so that the application starts quickly and avoids wasting mobile memory.
20. As a tabletop GM, I want One-shots to choose randomly from their variations, so that repeated effects sound natural.
21. As a tabletop GM, I want One-shots to play at a configurable interval range, so that effects can match the scene.
22. As a tabletop GM, I want to adjust a One-shot's timing, so that I can control how often it occurs.
23. As a tabletop GM, I want to play a One-shot immediately, so that I can trigger a specific kind of effect at the moment it matters.
24. As a tabletop GM, I want manual One-shot playback to remain audible when an Environment is stopped, so that I can trigger a one-off effect independently.
25. As a tabletop GM, I want Combat mode to replace ordinary music with Combat music, so that a battle changes the scene's musical intensity.
26. As a tabletop GM, I want Combat mode to add Combat ambiance to ordinary ambiance, so that battle effects layer onto the existing scene.
27. As a tabletop GM, I want to toggle Combat mode from the now-playing view, so that I can change intensity without leaving playback.
28. As a returning user, I want my legacy Environments to be migrated, so that the rebuild does not discard my preparations.
29. As a returning user, I want restored Environments to start stopped, so that opening the app never causes unwanted autoplay.
30. As a returning user, I want restored Sounds to avoid eager loading, so that the app remains responsive on a phone.
31. As a user, I want a Sound catalog failure to show an actionable error, so that I know why search or metadata is unavailable.
32. As a user, I want already-playing Environments to continue when catalog search fails, so that a service outage does not interrupt my game.
33. As a user, I want an unavailable Sound to be isolated from the rest of its Environment, so that one broken remote file does not stop the scene.
34. As a mobile user, I want the responsive layout and touch interactions to remain usable, so that I can run the soundboard from a phone.
35. As a keyboard user, I want Escape to close the relevant overlay, so that I can navigate editing quickly.
36. As a developer, I want fast focused tests for playback decisions, so that I can add features without waiting for real audio or a browser.
37. As a developer, I want browser tests for audio-policy and codec behavior, so that mobile and cross-browser regressions are visible.
38. As a developer, I want the Sound catalog and Icon catalog behind replaceable interfaces, so that the external providers can change without rewriting product behavior.

## Implementation Decisions

- Use Environment as the canonical product term. Do not carry the legacy Group name into the new domain model.
- Represent a Sound by its kind (Loop or One-shot) and placement (Ambiance or Combat). Combat mode is playback state, not a Sound kind.
- Keep the current Vite, React, TypeScript, Vitest, Testing Library, and Playwright foundation.
- Separate pure Environment/playback decisions from persistence, Sound catalog, Icon catalog, clock, randomness, and browser-audio adapters.
- Define a single high-level playback-coordinator seam that accepts user actions and injected dependencies, then produces observable state and audio commands.
- Keep Howler or its replacement inside the browser-audio adapter. The domain must not depend on browser audio APIs.
- The audio port supports Loop playback, One-shot variation playback, volume, fade, stop, unload, and separate manual One-shot playback.
- Preserve legacy semantics initially: two-second Loop fades, deferred loading, randomized inclusive minimum/maximum One-shot intervals, manual One-shot playback while stopped, and Combat music replacement plus Combat ambiance layering.
- Inject time and randomness into One-shot scheduling so tests are deterministic.
- Define a replaceable SoundCatalog for search and Sound metadata. The Firebase/Firestore service remains external to this repository.
- Define a replaceable IconCatalog for Environment icon search and selection. The underlying icon API remains external and swappable.
- Define a versioned persistence boundary that reads the legacy browser `groups` data, normalizes missing legacy fields, stops restored playback, and avoids eager loading.
- Isolate search, metadata, and audio failures from already-playing Environments and expose unavailable Sound state to the user.
- Initially preserve the legacy styling and responsive interaction model.
- Implement the work as vertical slices: legacy characterization, domain model, persistence migration, catalog contracts, playback coordinator, editing UI, and parity hardening.

## Testing Decisions

- Tests should verify externally observable domain behavior and user-visible outcomes, not React structure, Redux implementation details, Howler calls, or other incidental details.
- The primary seam is the playback/environment coordinator with deterministic fake time, randomness, persistence, catalogs, and audio port. This is the highest seam that can cover transitions, Combat mode, Loop fades, One-shot scheduling, manual playback, and failure isolation without a browser.
- Add characterization tests for the legacy contract before replacing behavior: Environment transitions, Combat rules, local-storage loading, migration fields, One-shot timing/randomness, Loop lifecycle, and manual One-shot playback.
- Add domain tests for create, rename, remove, Sound placement, volume, active Environment selection, Combat transitions, empty Environments, and unavailable Sounds.
- Add persistence adapter tests for legacy fixtures, versioning, stopped restoration, deferred loading, and preservation of names, Sounds, placements, volumes, icons, colors, and timing.
- Add SoundCatalog and IconCatalog contract tests using deterministic fakes and fixtures, including loading, empty, retry, and failure states.
- Add browser-audio adapter tests for real fade, looping, cleanup, codec selection, autoplay policy, and iOS behavior where a fake port cannot provide evidence.
- Add component tests for the Environment editor, search, add/remove flows, timing controls, Play now, volume controls, and now-playing Combat controls.
- Add focused Playwright workflows for the major user journeys and responsive desktop/mobile interactions. Retain Chromium, Firefox, and WebKit verification.
- Keep the Environment playback regression workflow covered end to end: create an Environment, search for `rain`, add `Heavy Rain`, play it, and verify that removing either the Sound or its Environment pauses the audio after the fade-out.
- The existing repository prior art is the Vitest/Testing Library unit and component setup plus Playwright smoke testing; the new tests should extend that foundation.

## Out of Scope

- Porting Firebase cloud functions, Firestore deployment, or the existing Sound catalog backend into this repository.
- Porting or reimplementing the icon provider; only its client boundary is in scope.
- User accounts and synchronized Environments across devices.
- Local WAV/MP3 import.
- A standalone quick soundboard for one-off Sounds outside an Environment.
- Search-result Sound previews.
- Native desktop/mobile packaging.
- PWA installability, service workers, offline caching, and background sync.
- New visual styling or a broad UX redesign before feature parity.

## Further Notes

The legacy source of truth is the local `redesign-may-2024` checkout at `C:\Users\benve\OneDrive\Documents\Dev\turbo-bard`. The repository already contains a detailed legacy behavior inventory and implementation plan. Any intentional deviation from characterization results should be documented before implementation changes the behavior.
