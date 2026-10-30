# Turbobard

Attempt at better cross-platform audio behavior.

## Prerequisites

- Node.js 26 (see `.nvmrc`)
- npm 11 or newer

## Development

```sh
# Clean install of all dependencies
npm ci

# Start dev
npm run dev
```

The app searches the legacy Firebase API and streams its real music/SFX files.
Copy `.env.example` to `.env.local` when overriding the default endpoints. Do
not put credentials or private tokens in `VITE_*` variables: Vite exposes those
values to the browser. If the legacy service later requires authentication, add
a server-side proxy rather than committing or exposing a secret.

## Verification

```sh
# Full suite of tests and checks
npm run verify
```

Focused commands are available for linting, typechecking, unit tests, coverage, the production build, and browser tests. `npm run test:e2e:chromium` is the fast local browser mode; `npm run test:e2e` runs Chromium, Firefox, and WebKit.

Unit tests are isolated and run in jsdom. End-to-end tests run against the local production preview server and do not require external services. Failed Playwright runs retain traces, screenshots, videos, and the HTML report.

For a first local browser run, install Chromium once with `npm run test:e2e:install`. The diagnostic command `npm run test:e2e:chromium:debug` enables full tracing and the line reporter. Browser runs stop after bounded test, server-start, or global timeouts; inspect `playwright-report/` and `test-results/` when a run fails. If a browser cannot launch, rerun the install command before debugging the application.

## Deployment

See [deployment operations](docs/deployment-operations.md) for private staging
setup, build identities, retained artifacts, explicit restaging, and the manual
Publish and deploy workflow. Private production requires its own bootstrap setup;
the domain cutover remains a separate launch.
