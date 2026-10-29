# ADR-0005: Preserve legacy production origins at cutover

- Status: Accepted
- Date: 2026-10-28

The legacy app serves both `http://turbobard.com` and `https://turbobard.com`,
whose browser saves belong to separate origins. Serve the rebuilt app at both
unchanged origins during cutover so its existing legacy adapter can migrate
each store in place, as described in [ADR-0004](0004-migrate-legacy-environments.md).
Keep HTTPS as the preferred address, but do not enable forced HTTPS redirects
or HSTS as part of this deployment.

Forcing HTTPS would simplify the public destination and remove unencrypted
page delivery, but would prevent the new app from directly accessing HTTP-only
saves. Preserving both origins accepts continued HTTP delivery and independent
save collections to meet the requirement that existing saves appear intact.
Consolidating users onto HTTPS requires a separate migration decision; a
cross-origin transfer bridge is not required for this cutover.
