# Deployment operations

The implemented slices provide verified build retention, build identity in About,
private staging, and manual publication/promotion of those exact files to private
production. The accepted target is recorded in [deployment-design.md](deployment-design.md).
Production bootstrap and the coordinated domain launch are separate operating steps.

## Bootstrap private staging

1. In the selected Cloudflare account, use Workers Free and Zero Trust Free.
   Create the existing Worker named `turbobard-staging` with placeholder content.
   Do not connect a Git repository or enable Cloudflare automatic builds.
2. In that Worker's **Access** tab, protect this Worker using **Cloudflare account**
   login. Select the policy for members of this account. Use a Worker-level rule,
   not an account-wide rule or just a hostname rule. Account membership changes
   also change who can sign in. This rule covers assets and all Worker routes.
3. Manually confirm signed-out visitors cannot access the placeholder and that
   your account can sign in. Do this before enabling application deployment.
   Do not attach `turbobard.com`, change DNS, or enable paid features.
4. Create a deployment API token with **Editor** access scoped only to this
   existing Worker. Resource creation/Access administration belong to bootstrap
   credentials, not this routine deployment token. Do not grant DNS access.
5. Create the GitHub deployment environment `staging`. Limit deployment branches
   to `main`, without requiring reviewers. Add environment secrets
   `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.
6. Set the **repository** Actions variable `STAGING_DEPLOY_ENABLED` to `true` only
   after the private Worker and secrets are ready. When unset, verification and
   retention still run, but staging is skipped. An environment-level variable
   cannot enable a job because its `if` is evaluated before the environment loads.
7. Once this workflow is on `main`, push a change or explicitly restage a commit.
   Read the successful staging job's summary and check the provider URL manually.
   Confirm signed-out denial, account login, About identity, real catalog search,
   and audible playback. Asset deployments do not manage Access applications;
   check that the platform rule remains enabled after the first deployment.

These steps follow Cloudflare's [Worker-level Access controls](https://developers.cloudflare.com/workers/configuration/cloudflare-access/)
and [Worker-scoped deployment permissions](https://developers.cloudflare.com/workers/authorization/).
The checked-in [staging configuration](../wrangler.staging.jsonc) deploys static
assets only, disables preview URLs, and contains no custom-domain routes or
Access policy. It does not configure HTTP redirects or HSTS.

## Build and staging behavior

Every push to `main` and every PR runs formatting, lint, typechecking, unit tests,
one production build, and the complete Playwright matrix (Chromium, Firefox,
WebKit, and the configured mobile projects). Browser tests serve that existing
output. The About values are compiled into the browser bundle; `build-info.json`
contains the same full source SHA, `runId.attempt` build ID, and UTC build time.
Local builds use the current source SHA and the ID `local`.

Only verified `main` builds are retained for 30 days. PR artifacts cannot deploy.
The upload's immutable artifact ID and archive SHA-256 are recorded in the
workflow summary and passed directly to staging. The deployment job checks the
GitHub artifact record, hashes the actual downloaded ZIP, and checks its embedded
source/build identity before deploying. Mismatches and unavailable artifacts fail
the job; no rebuild or alternate artifact is selected. This explicit digest check
fails the deployment rather than relying on a download action's warning behavior.
See [GitHub's artifact API](https://docs.github.com/en/rest/actions/artifacts).

Superseded verification jobs can be cancelled. Staging deployments share a lock
and do not cancel an active deployment. A pending deployment can be superseded
by another queued run. Verification failure never invokes deployment; a failed
upload/integrity check leaves the previous staging version in place. If a deploy
command fails, inspect Cloudflare's deployment status before assuming whether
the new files became active. Browser failure diagnostics are retained for 14 days.

No runtime deployment lookup, update polling, forced refresh, service worker,
hosted browser checks, or Access service credentials are introduced. Open tabs
continue running their loaded build until the user opens or refreshes the app.

## Restage or retry

In GitHub Actions, choose **Verify → Run workflow**, select branch `main`, and
enter the full 40-character source commit SHA in `source_sha`. It must be an
ancestor of current `main`; feature-branch-only commits are rejected. This runs
full verification and creates a fresh build ID and timestamp. Old commits must
contain the build-identity implementation to qualify. Personally check this new
build again even if you checked the same source previously.

For an isolated staging deployment failure while the artifact is retained,
rerun failed jobs. The deployment uses the original verification job's outputs,
including its original run attempt, rather than inventing a new artifact name.
Rerunning all jobs creates a new build identity. If the artifact is expired or
deleted, explicitly restage and recheck. An expired artifact does not expire a
deployed site.

## Remaining deployment slices

- Bootstrap the separate private `turbobard-production` Worker, scoped token and
  GitHub environment; enable immutable Releases and workflow-failure notifications.
  Keep direct pushes to `main` available.
- Reproduce migration and audible playback using the actual live legacy save
  format before launch, fixing the suspected playback-source conversion gap if
  confirmed. This staging implementation makes no save migration changes.
- Execute the coordinated DNS/certificate/domain launch separately. Follow
  [ADR-0005](adr/0005-preserve-legacy-production-origins.md): retain both apex HTTP
  and HTTPS origins, avoid HTTPS redirects/HSTS, preserve legacy hosting during
  overlap, and keep staging private when production becomes public.

## Bootstrap private production

1. Create the existing `turbobard-production` Worker on the Free plan, without
   Cloudflare source builds or domain routes. Apply its own Worker-level Access
   rule using Cloudflare account login and selected-account membership, just as
   for staging. Check signed-out denial and successful account login first.
2. Create a separate Worker-scoped Editor deployment token. Create the GitHub
   environment `production`, allow only the `main` branch, and add its own
   `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` secrets. Do not require
   reviewers: manually dispatching the workflow is the owner's sole approval.
   Do not restrict this environment to release tags; the workflow runs from main.
3. Enable immutable Releases in repository Settings → General → Releases. With
   an administrator's local `gh` login, the equivalent is:

   ```sh
   gh api --method PUT repos/bencodrington/turbobard/immutable-releases
   gh api repos/bencodrington/turbobard/immutable-releases
   ```

   Confirm `enabled: true` before proceeding. Enable GitHub failed-workflow
   notifications in your account's notification settings. Keep direct main pushes
   available. The routine workflow token has no Administration permission to
   inspect/change the repository setting; bootstrap must establish it. The
   workflow additionally refuses to deploy a published release unless GitHub
   reports that release as immutable. If bootstrap was missed, this last check
   can fail after publication, leaving a published mutable release to investigate.

4. Set the **repository** Actions variable `PRODUCTION_DEPLOY_ENABLED=true` only
   after the private Worker, environment, secrets, and release immutability are
   ready. Until then the publication job is skipped, and no release is created.
5. After this slice reaches main, let Verify stage a fresh build and personally
   check it. Existing builds from before this slice lack the durable staging
   receipt required for promotion. Explicitly restage/recheck if necessary.

The checked-in [production configuration](../wrangler.production.jsonc) contains
only static assets and the provider URL. It does not configure Access, domain
routes, redirects, or HSTS. Deploying assets must preserve the bootstrap Access
rule. Manually verify that rule after the first deployment.

## Publish and deploy a checked build

1. Check the staged app's sign-in behavior, real catalog search, and audible
   playback. Read the exact `runId.attempt` build ID in About and confirm that
   this is the build you checked, even if staging has since advanced.
2. In Actions, select **Publish and deploy → Run workflow**, choose `main`, and
   enter that exact build ID. Optional `version` accepts `vMAJOR.MINOR.PATCH`;
   optional `notes` replaces generated notes. Empty version selects the next
   unused patch, initially `v0.1.0`. Existing numbered tags, releases (including
   drafts), and reserved publication intents are all considered. Overrides must
   be unused and higher than previously reserved numbered versions.
3. Run the workflow. This attests that you personally checked this exact build.
   Automated checks require Verify on main, successful verification for that
   attempt, successful staging with its durable receipt, current-main ancestry,
   retained artifact identity, archive SHA-256, and embedded build information.
   They do not substitute for the manual deployed-site checks.
4. The workflow reserves a publication intent keyed by the workflow run ID in a
   GitHub deployment record under `production-publication`. It creates a draft,
   uploads `publication.json` and the original artifact ZIP as `build.zip`, verifies
   both assets, and publishes a normal immutable Release pinned to the full source
   SHA. Draft preparation is internal to this single workflow, with no human
   draft-review step. This follows [GitHub's immutable-release process](https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository).
5. The same job deploys the extracted retained files without a rebuild. Read its
   publication and deployment summary, then manually check the private production
   provider URL, signed-out denial, About identity, catalog, and audible playback.
   Publishing alone does not mean that production deployment succeeded.

Only manual dispatch of this workflow from main can publish/deploy. Tag pushes,
external releases, drafts, and prereleases do not trigger it. The workflow's
`contents: write` permission creates releases; it needs no PAT or second release
event workflow. Notes/title can still be edited after publication.

## Retry a publication or failed production deployment

Use **Re-run failed jobs** or **Re-run all jobs** on the original Publish and
deploy run. Its run ID persists across attempts, so retries load the same reserved
version, source, build ID, artifact ID, and digest. An empty version input never
allocates another version for that intent. Partial draft uploads resume; already
published assets are checked and never replaced. A fresh manual dispatch is a new
publication intent and consumes a new higher version if successful.

All eligibility checks, publication, version checks, and deployment share the
`cloudflare-production` lock, with cancellation disabled for active jobs. GitHub
may replace a pending run with another pending run; inspect its status and rerun
if needed. The lock does not promise FIFO ordering.

Before calling Cloudflare, the workflow writes a production deployment record
containing the publication identity. This is a conservative version high-water
mark: even a failed, cancelled, or uncertain newer deployment blocks an older
retry. This prevents a lost Cloudflare response from allowing older code to
overwrite a possibly active newer version. Retry that newer intent, or publish
the desired eligible code as a still higher version. Do not delete publication
intent or production deployment history; they are recovery state, not disposable
logs. Deployment statuses show reported success/failure; inspect Cloudflare if
the command or status write was interrupted.

If the retained Actions artifact expires or disappears, promotion/retry fails
closed even when the Release has an attached ZIP. Restage and personally check a
new build, then start a new publication with a higher version. A deliberate code
reversion also needs a new higher version. This does not guarantee saved-data
downgrade compatibility. DNS and the legacy domain remain part of the later launch.
