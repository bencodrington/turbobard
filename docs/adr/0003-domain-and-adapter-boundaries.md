# ADR-0003: Keep domain playback independent from external and browser adapters

- Status: Accepted
- Date: 2026-10-23

The rebuild separates pure Environment and playback decisions from persistence, sound-catalog, icon-catalog, clock, randomness, and browser-audio adapters. This preserves a fast TDD loop, allows the Firebase and icon services to remain outside this repository, and makes Howler/browser behavior replaceable without rewriting product rules.

## Consequences

Most behavior can be tested with deterministic fakes. Integration and browser tests remain responsible for adapter contracts, autoplay policy, codecs, iOS behavior, and real audio lifecycle details.
