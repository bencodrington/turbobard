# Deployment operations

The first implementation slice provides verified build retention, build identity
in About, and private staging. The accepted target is recorded in
[deployment-design.md](deployment-design.md). Production publication/promotion,
immutable Releases setup, and domain launch are subsequent work; there is no
production deployment workflow yet.

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

- Implement **Publish and deploy** with the exact checked build ID, eligibility
  and integrity validation, pinned source, automatic patch numbering, immutable
  release assets, retry identity, and version-forward checks under a production
  lock. Neither tag pushes nor external release events should deploy.
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
