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

### PR evidence

Save generated screenshots and recordings under ignored `docs/evidence/` or an external temporary directory. Keep generated review evidence out of commits; preserve application assets in their normal source locations.

Upload captures to durable PR attachments or other accessible media hosting. Embed before/after screenshots directly in the PR description with `![description](url)` and use GitHub's playable attachment embeds for videos. Verify the rendered PR displays each image or video inline. If media upload or rendering is blocked, report the blocker rather than substituting ordinary links or committing captures.
