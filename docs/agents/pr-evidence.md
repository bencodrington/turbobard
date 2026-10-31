# PR evidence

Capture before/after UI evidence with automated Playwright tests. Computer Use is never allowed for inspection, capture, upload, or rendering verification.

Keep captures under ignored `docs/evidence/` or an external temporary directory. Preserve application assets in their normal source locations.

Use the `pr` skill's **Evidence** procedure to upload images and videos directly into the PR description with `gh pr create` or `gh pr edit --attach`. Read `gh pr edit --help` before declaring attachment uploads unavailable. Release assets are unnecessary for this workflow.

Verify each image appears inline and each video has an inline player using GitHub's returned HTML through CLI/API tools. Report concrete upload or verification blockers; ordinary asset links and committed captures do not satisfy the evidence requirement. For non-visual changes, provide execution evidence and state why new visual captures are not applicable.
