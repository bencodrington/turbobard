## Agent skills

### Issue tracker

Issues and specs live in GitHub Issues via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Use the canonical labels `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, and `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

This is a single-context repo using root `GLOSSARY.md` and `docs/adr/`. See `docs/agents/domain.md`.

### Implementing ticket work

When using the `implement` skill with a ticket, start from `main` on a new branch named with the issue number followed by a short kebab-case description, such as `2-playback-contract`.

### Node tooling

When running Node or npm commands, read `docs/agents/node-tooling.md` first and use the Node version declared in `.nvmrc`.
