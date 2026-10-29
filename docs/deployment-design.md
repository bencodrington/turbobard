# Deployment design

The owner confirmed this deployment design and completed the interview on
2026-10-28, choosing to finish with documentation rather than begin
implementation. All design questions are settled, including one-action
production publishing. This document is the agreed design record and operating
outline for future implementation. Implementation tickets/specs belong in
GitHub Issues; domain launch remains a separate later decision.

## Confirmed scope

- Deploy the rebuilt frontend while keeping the existing catalog APIs and audio
  storage in place. Confirmed on 2026-10-28.
- Existing API and audio services remain operational dependencies; their costs
  are separate from the new frontend hosting costs.
- Use managed hosting. Focus learning on CI/CD, releases, DNS, and recovery rather
  than operating a server.
- Target $0/month for the new staging and production hosting, with up to
  $10/month acceptable when justified. Domain renewal and existing API/audio
  expenses are outside this allowance.
- Identity-based access is acceptable for staging; a shared password is not
  required.
- Use Cloudflare account login for staging and private replacement production,
  restricted to members of the selected Cloudflare account. Adding account
  members later also broadens access under this policy.
- Use Cloudflare Workers Static Assets for staging and production, with
  Cloudflare Access protecting staging. Keep the current domain registrar;
  connecting the production apex domain will require moving DNS management to
  Cloudflare and preserving existing DNS/email records.
- The owner does not use email at `turbobard.com`; no email-forwarding migration
  is required. Existing unused mail records are not evidence of a required
  service. Inventory current DNS before moving it; do not silently assume
  Namecheap forwarding remains operational after the move.
- Start with one stable staging deployment. Do not add automatic per-PR previews
  initially.
- Keep replacement production behind its own Cloudflare Access rule until the
  owner chooses to go live. The owner authorized this if adding/removing the
  gate is straightforward; current Cloudflare documentation confirms a
  Worker-level platform setting, separate from application code and assets.
  Staging remains protected after production is made public.
- Use a single manual Publish and deploy workflow for production. The owner
  selects the exact checked CI build ID and clicks Run workflow as the sole
  approval. The workflow validates eligibility and the retained artifact,
  publishes a normal numbered GitHub Release, and deploys that exact artifact.
  Select its source commit explicitly; do not default to the tip of `main` or
  choose another build from the same source commit.
- Automatically choose the next unused patch version, starting at `v0.1.0`, and
  generate release notes. Provide optional version and notes overrides. There
  is no separate human draft-review or Publish button step. Drafts, prereleases,
  tag pushes, and releases created outside this workflow do not independently
  trigger production deployment.
- Enable immutable published GitHub Releases. Their version tags and attached
  assets cannot be replaced after publication; correcting a mistaken publication
  requires a new version. Titles and release notes remain editable.
- Production version numbers only advance. Under the deployment lock, reject
  an older release retry that would replace a newer deployed version. An
  intentional return to eligible older code uses a new higher version; this
  does not imply a saved-data downgrade compatibility guarantee.
- At the eventual domain cutover, existing users' localStorage saves must appear
  intact in the rebuilt app. An export/import-only process does not satisfy the
  requested automatic experience. HTTP-origin storage must be addressed rather
  than assuming every user already accesses the legacy site over HTTPS.

## Agreed delivery flow

Confirmed on 2026-10-28:

- Deploy staging only after the exact `main` commit passes the full existing
  verification suite, including Chromium, Firefox, and WebKit. Failed checks
  leave the previous successful staging deployment available.
- Production releases may target only commits from `main` that successfully
  reached staging and were personally checked there by the owner. A previously
  checked commit remains eligible even after `main` advances; a feature-branch
  commit is ineligible.
- Promote the same built files from staging to production, without rebuilding
  at release time. Retain and verify the source/build association. If the
  corresponding artifact is unavailable, block release until restaging rather
  than silently creating an unreviewed replacement build.
- Use GitHub Actions for verification, building, and deployment. Do not enable a
  second automatic build/deploy pipeline in Cloudflare.
- Keep direct pushes to `main` allowed. Do not add mandatory PRs or branch
  protection as part of this work. Staging deployment remains gated by the full
  verification suite regardless of how the commit reached `main`.
- Store separate Worker-scoped deployment API tokens in separate GitHub
  deployment environments. Each token can update only its corresponding
  existing Worker; routine deployments should not need DNS administration.
- Starting Publish and deploy attests that the owner checked that exact build on
  staging. Do not add another manual approval gate; automated eligibility and
  integrity checks still apply before publication and deployment.
- Retain successful `main` build artifacts for 30 days and failed-browser
  diagnostics for 14 days. Expiration blocks future promotion of that artifact
  until restaging; it does not expire an already deployed site.
- Keep deployed-site checks manual initially. The owner checks sign-in behavior,
  the deployed build, real catalog access, and audible playback before releasing.
  Retain the full automated verification suite against the local production
  build. Do not add Access service credentials, automated deployed smoke checks,
  or a hosted browser-test suite initially.
- Add the short source commit, unique CI build ID, and build time to the existing
  About display. Embed these values when building so staging and production
  retain the same identifiers and the display describes the code actually
  running in that tab. Do not substitute a later runtime lookup of the newest
  deployment. Showing a published release tag inside the app is not required.
- Releases take effect on the next page open or refresh. Do not automatically
  refresh active tabs or add update-available polling/prompts initially, so an
  active tabletop audio session is not interrupted by deployment.
- Initially use GitHub failed-workflow notifications and Cloudflare's available
  built-in metrics/dashboard. Do not add a separate uptime monitor or browser
  error tracking service. These controls are not a continuous availability or
  audio-playback check.
- Keep `https://turbobard.com` as the permanent primary production address, with
  `www` redirecting there. Serve the rebuilt app at both existing apex origins,
  HTTP and HTTPS, so each migrates its own saves in place. Do not add forced
  HTTP-to-HTTPS redirects or HSTS as part of cutover. See
  [ADR-0005](adr/0005-preserve-legacy-production-origins.md).
- Perform the DNS move and app cutover in one coordinated launch effort, rather
  than a separate earlier DNS migration. Within that effort, preserve legacy
  GitHub Pages routing as DNS-only while delegation and certificate issuance
  settle, wait for active certificate coverage, then attach the new Worker and
  make production public. This is not a promise of an instantaneous nameserver
  switch or zero downtime; the legacy deployment remains available during the
  overlap.

The source commit and exact CI build are both part of release identity. A
commit alone is insufficient when it has been rebuilt: a rerun creates a
distinct run attempt, build time, and artifact. Publish and deploy pins that
identity before publication and retains it through deployment and any retry.

## One-action publication and failure handling

This supersedes the earlier Prepare release plus manual publication proposal.
The owner chose one action with automatic patch numbering and optional
overrides to minimize release friction.

- Validate source, staging, retained artifact, digest, and version before
  publication; pin the release tag to the selected build's full source SHA.
  Continue deployment in the same workflow because a release created with
  `GITHUB_TOKEN` does not trigger an ordinary second release-event workflow.
- Allow the trusted `main` dispatch ref in the production GitHub environment;
  do not configure it to allow only release-tag refs. Grant GitHub release-write
  permission only where needed; no additional PAT/GitHub App token is required.
- Publication and deployment are separate operations. A release can publish
  successfully while deployment fails; the deployment status determines what
  reached production. Retrying resumes the existing version/build instead of
  recreating an immutable release or consuming another automatic version.
  Associate the selected version with the original publication intent so a
  rerun with an empty version input resumes rather than recalculates it. Block
  retries of older versions once a newer production version is deployed.

This removes the human review checkpoint before publication. Validation still
rejects an invalid build/version before publishing. Notes remain editable after
publication; a mistaken immutable tag/build requires a new release version.

References: [manual workflow execution](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow),
[workflow token event behavior](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow),
and [GitHub CLI release creation](https://cli.github.com/manual/gh_release_create).

## Requested behavior

- Staging updates automatically when `main` changes and requires authentication.
  Identity-based login satisfies the access requirement.
- Production updates only when the owner chooses to release.
- Keep the legacy app at `turbobard.com` until the owner is ready to switch.
- Prefer inexpensive, lightweight hosting suitable for a small active audience.

## Agreed implementation defaults

- Use separate `turbobard-staging` and `turbobard-production` Workers in the same
  Cloudflare account, with stable provider URLs before domain cutover.
- Start on zone Free, Workers Free, and Zero Trust Free, without paid add-ons.
  Existing API/audio costs and domain renewal remain separate. Inspect any
  proposed paid requirement against the agreed budget before enabling it.
- Keep Cloudflare's default static-asset cache revalidation initially. Do not
  add a cache-everything rule, service worker, or offline/PWA behavior. An open
  tab's About values remain those embedded in its running build.
- Keep cancellation of superseded verification work, serialize deployments per
  Worker, and avoid interrupting an in-progress production deployment. Check
  production version eligibility inside the shared deployment lock; a queue
  alone does not establish publication order or prevent old retries.
- Identify a build by full commit, CI run ID, and run attempt, with artifact ID
  and digest recorded when uploaded. The same retained output is tested and
  deployed. Missing artifacts or integrity mismatches fail closed; do not
  silently rebuild or choose another artifact from the same commit.
- Permit explicit restaging of an eligible `main` commit when its artifact has
  expired, rerunning full verification and producing a new build identity for
  manual checking. Normal `main` pushes continue to update staging.
- Use workflow summaries and short operating instructions for setup, staging
  checks, one-action publishing, failed deploys, expired builds, and
  the later domain cutover. Saved-data rollback and automatic live-site testing
  remain outside the initial scope.

## Operating outline

### Initial setup

1. Prepare repository changes for build metadata/About, retained artifacts,
   staging deployment, one-action publication/production promotion, and
   explicit restaging. Use the Node version in `.nvmrc`.
2. Run the full verification suite. Existing scripts already build once, then
   Playwright serves that output through Vite preview; do not add a rebuild
   between testing, artifact upload, and deployment.
3. Create the two Cloudflare Workers and their separate native Access rules.
   Complete the one-time Free-plan/Zero Trust setup and restrict account login
   to members of the selected account. Keep both deployments private initially.
4. Create separate scoped deployment tokens and configure GitHub deployment
   environments/secrets. The production environment allows the trusted `main`
   workflow dispatch, which creates its release tag afterward. Bootstrap
   permissions to create/configure resources are separate from ongoing deploy
   credentials.
5. Enable immutable GitHub Releases and failed-workflow notifications. Keep
   direct pushes to `main` available and Cloudflare's automatic source builds
   disabled. Ordinary asset deployments must preserve the native Access rules.
6. Verify the private staging and replacement-production URLs manually,
   including signed-out denial, account login, About identifiers, catalog
   search, and audible playback. Leave the live legacy domain unchanged.

### Each ordinary production release

1. Push or merge a change into `main`. Full verification passes, the exact output
   is retained, and staging is updated.
2. Manually check the staged app and read its CI build ID in About. If staging
   advances during checking, confirm which build was actually checked.
3. Run Publish and deploy with that exact build ID. Leave version and notes
   empty for automatic patch numbering and generated notes, or supply overrides.
   Clicking Run workflow is the sole production approval.
4. The workflow validates version syntax, current-main ancestry, successful
   staging, the exact retained build and digest, and the version-forward rule
   under the deployment lock. It then publishes the pinned immutable GitHub
   Release and deploys without rebuilding, within the same workflow.
5. Check production manually and inspect its About build information. Active
   sessions continue running their loaded version; users refresh when ready.

If an artifact has expired, restage and recheck its new build identity before
publishing. If publication/deployment fails, inspect the workflow summary and
logs. Retrying that publication intent resumes the same version and build when
still eligible; it does not recreate/change the immutable release or consume a
new automatic version. Do not silently select another artifact. A deliberate
code reversion uses a new higher version.

### One coordinated domain launch

1. Verify a selected production release on its private provider URL. Verify that
   realistic legacy saves migrate and play correctly before the domain switch.
2. Inventory DNS and recreate the existing legacy web records as DNS-only in
   Cloudflare. Recheck DNSSEC/delegation state at execution. No domain-email
   forwarding migration is required for this owner.
3. Change nameservers during this launch effort. Keep the legacy deployment and
   custom-domain association available while delegation changes and the
   Cloudflare zone/certificate activate. Certificate issuance may take 15
   minutes to 24 hours; a single launch effort can include this waiting stage.
   See [Universal SSL preparation](https://developers.cloudflare.com/ssl/edge-certificates/universal-ssl/enable-universal-ssl/).
4. After active certificate coverage is confirmed, attach `turbobard.com` to the
   replacement Worker, remove only production's Access gate, and configure the
   `www` redirect. Keep apex HTTP and HTTPS available; do not enable forced HTTPS
   redirects or HSTS. Treat Worker custom-domain attachment as the routing
   change, not as harmless early preparation.
5. Manually verify both apex protocols, the `www` redirect, signed-out public
   production access, saved Environments, and real audio. Verify staging still
   requires login. Keep the legacy host available during DNS cache overlap.

This outline does not promise zero downtime or synchronized DNS cache expiry.
Universal SSL's existing active coverage should be checked before attaching the
Worker; verify the actual apex immediately afterward rather than assuming a
newly requested Worker certificate has finished provisioning.

## Deferred work

- The owner explicitly deferred saved-data rollback compatibility work as a rare
  edge case. Do not make a tested downgrade path to the previous rebuilt release
  a release requirement. Restoring a deployment's files does not imply restoring
  browser saves; no such compatibility guarantee is part of this plan.
- Automated checks of deployed sites, including Access service-token setup.

## Cutover facts to account for

- Browser storage is scoped to the exact origin. Keeping
  `https://turbobard.com` lets the rebuild read the legacy HTTPS saves; HTTP saves
  belong to a separate store that HTTPS code cannot directly read.
- The legacy site was observed serving both protocols without an HTTP redirect.
  Serving the rebuilt app at both unchanged origins permits each store to
  migrate in place. A transfer bridge is only needed if moving saves between
  protocols; it is not a prerequisite for an origin-preserving cutover.
- If HTTPS enforcement is chosen later, an HTTP transfer bridge would need to
  execute before an HTTPS redirect or HSTS upgrade. Browser upgrades and dormant
  users prevent a universal invisible cross-protocol transfer guarantee. Guided
  recovery has not been accepted; do not assume that exception to preservation.
- The rebuild migrates `groups` into its versioned `environments` document and
  preserves the original legacy key. Later edits are not written back to the
  legacy key, so returning to the legacy app is not a data rollback.
- Migration verification must cover the actual live legacy save format, which
  predates some changes on the local legacy development branch.
- Inspection suggests a migration playback gap: legacy bare filenames require
  storage URL/extension conversion, while the current persistence adapter copies
  filenames, samples, and attribution links into fields the browser audio
  adapter treats as playback sources. This has not been reproduced in a test.
  Before cutover, verify and, if necessary, fix loading and playing a realistic
  legacy save. Comparing displayed names and migrated JSON alone is insufficient
  to establish that users' saved Environments still work.

Sources: [MDN localStorage](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage),
[MDN HSTS](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Strict-Transport-Security),
[existing migration ADR](adr/0004-migrate-legacy-environments.md), and read-only
inspection of the live legacy deployment on 2026-10-28. Recheck live hosting
behavior during implementation.

Temporary production protection uses
[Cloudflare's Worker-level Access controls](https://developers.cloudflare.com/workers/configuration/cloudflare-access/).
Use separate Worker-level rules rather than an account-wide rule so production
can become public independently. Removing the gate is a platform configuration
change; do not add application authentication code or bake access settings into
the shared browser artifact.

## Primary references

- [Cloudflare Static Assets](https://developers.cloudflare.com/workers/static-assets/)
  and [billing](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/).
- [GitHub Actions deployment to Cloudflare](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/).
- [Worker-scoped deployment permissions](https://developers.cloudflare.com/workers/authorization/).
- [Worker custom domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/).
- [Static-asset cache headers](https://developers.cloudflare.com/workers/static-assets/headers/).
- [GitHub artifact retention](https://github.com/actions/upload-artifact#retention-period)
  and [immutable releases](https://docs.github.com/en/code-security/concepts/supply-chain-security/immutable-releases).
- [GitHub deployment concurrency](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency).

Keep product terminology in the root glossary; general deployment vocabulary
does not introduce new product concepts.
