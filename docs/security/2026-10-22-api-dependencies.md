# API abuse and dependency review — 2026-10-22

Scope: public Cloudflare deployment and local Next runtime dependency locks; API entry rate limiting. Not a full repository or Git history audit.

## Changes

- Next 14.2.35 → 15.5.28 (retains React versions); move outputFileTracingIncludes to the supported top-level setting.
- PostCSS 8.5.31 and source-map-js 1.2.2 pinned through overrides in both dependency trees; Cloudflare fflate pinned to compatible 0.7.5.
- Cloudflare Worker wrapper uses native rate-limit binding, namespace 2026102201, 120 API POST requests / 60 seconds per Cloudflare client IP per location, shared across /api/ai, /api/ai/* and /api/credentials/seal. Other paths and methods are unchanged.
- Counter keys are daily SHA-256-derived addresses; no article, API credential or plaintext IP is passed into the limiter. This is pseudonymization, not guaranteed anonymization. No persistent application database added.
- A denied request returns 429, Retry-After: 60 and no-store. Platform limiter failures fail open to preserve service availability. Local Next server has no edge limiter. Missing edge IP skips limiting for local preview.
- Native counters are approximate and local to Cloudflare locations. Shared NAT users share a generous threshold. Distributed abuse or stolen-key spend is not fully prevented. This is not a billing quota or credential revocation mechanism.
- Credentials, keyring and storage schema unchanged. Deployment uses the existing Worker-only GitHub secret; no added account permissions.

## Remaining dependency reports

After updates npm audit reports root: 3 moderate entries; Cloudflare: 7 high and 3 moderate entries. These represent propagation from two advisories, not ten independently confirmed website exploits:

- GHSA-vfj7-8cjw-p6xm: braces <=3.0.3, no published patched version. Present through fast-glob / vite-plugin-dynamic-import / vite-plugin-commonjs / vinext. Used to expand build-time import/file patterns, not visitor article content. Source review found no public API path supplying these patterns. Do not accept untrusted source/build configurations. Do not downgrade vinext to the audit tool's suggested 0.2.1.
- GHSA-hp3w-g68c-fv3c: sprintf-js <=1.1.3, no published patched version. Via argparse in mammoth/bin/mammoth. Site uses Mammoth's conversion library, not its CLI. No application use of attacker-controlled sprintf format strings found. Do not downgrade Mammoth to 0.3.29.

Revisit these reports when upstream releases fixes or application usage changes. Audit counts are a dated snapshot, not a guarantee of no unknown vulnerabilities.

## Validation

Unit suite includes shared rate-limit buckets, independent addresses, 429/no-cache/retry behavior and unaffected page routes. Production HTTP probe uses only generated dummy credentials and a local provider; verifies saved credentials, upstream error privacy, redirects, streaming completeness and Cloudflare native 429 on repeated empty requests (no paid calls).

References:
- https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/
- https://github.com/advisories/GHSA-vfj7-8cjw-p6xm
- https://github.com/advisories/GHSA-hp3w-g68c-fv3c
