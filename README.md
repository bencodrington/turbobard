# Turbobard

Attempt at better cross-platform audio behavior.

## Prerequisites

- Node.js 24 LTS (see `.nvmrc`)
- npm 11 or newer

## Development

```sh
# Clean install of all dependencies
npm ci

# Start dev
npm run dev
```

## Verification

```sh
# Full suite of tests and checks
npm run verify
```

Focused commands are available for linting, typechecking, unit tests, coverage, the production build, and browser tests. `npm run test:e2e:chromium` is the fast local browser mode; `npm run test:e2e` runs Chromium, Firefox, and WebKit.

Unit tests are isolated and run in jsdom. End-to-end tests run against the local production preview server and do not require external services. Failed Playwright runs retain traces, screenshots, videos, and the HTML report.

For a first local browser run, install Chromium once with `npm run test:e2e:install`. The diagnostic command `npm run test:e2e:chromium:debug` enables full tracing and the line reporter. Browser runs stop after bounded test, server-start, or global timeouts; inspect `playwright-report/` and `test-results/` when a run fails. If a browser cannot launch, rerun the install command before debugging the application.
