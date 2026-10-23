# ADR-0002: Defer PWA capabilities until offline requirements are known

- Status: Accepted
- Date: 2026-10-23

## Context

PWA can mean installability, offline startup, runtime caching, offline data, background sync, and notifications. Choosing a service-worker and caching strategy before the application’s data model and offline requirements are known can create stale-code and stale-data problems.

## Decision

Defer PWA implementation. The initial scaffold will not include a service worker, web app manifest, offline caching, or install prompts. Revisit this decision when the application’s offline and caching requirements are defined.

## Consequences

The initial application behaves as a conventional web application and avoids service-worker state during development and testing. PWA capabilities remain a deliberate future decision rather than an accidental default.
