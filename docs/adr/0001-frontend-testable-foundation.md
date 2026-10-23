# ADR-0001: Establish a testable frontend foundation

- Status: Accepted
- Date: 2026-10-23

## Context

Turbobard needs a frontend foundation that agents can exercise and verify without external services. The project is intended to explore cross-platform audio behavior, but its first scaffold should not prematurely choose an audio engine, backend, or persistence model.

## Decision

Use Vite, React, and TypeScript for the application. Use Vitest and Testing Library for isolated unit/component tests, and Playwright for browser-based end-to-end tests. The verification contract includes formatting, linting, typechecking, unit tests, a production build, and E2E tests. CI runs all supported Playwright browser projects: Chromium, Firefox, and WebKit.

## Consequences

Agents get fast focused tests and a full self-contained verification command. CI provides cross-browser evidence and preserves Playwright diagnostics on failure. The initial dependency set stays frontend-only and domain-light.
