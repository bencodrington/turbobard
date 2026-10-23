# ADR-0004: Migrate legacy browser environments into a versioned format

- Status: Accepted
- Date: 2026-10-23

The rebuild reads the legacy `localStorage["groups"]` data from the `redesign-may-2024` application and migrates it into a versioned Environment format. Restored playback is always stopped and audio loading is deferred, preserving user data while preventing legacy autoplay and memory behavior from leaking into the new runtime.

## Considered options

- Discard legacy browser data: simpler, but breaks existing users and makes the rebuild needlessly disruptive.
- Keep writing the legacy shape forever: minimizes initial migration work, but couples the new domain model to legacy arrays and unversioned data.

The versioned adapter keeps compatibility at the boundary and lets the new model evolve independently.
