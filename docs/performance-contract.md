# Performance contract

This document is the long-lived performance boundary for the trip workspace. It applies to Planning, the recommendation library, Costs, Map, future home-page presentation work, and future media features.

## Data and cache boundaries

- Private workspace HTML, RSC responses, session state, member views, and permission-dependent data remain `no-store`. They must never use `cacheEverything` or a shared public cache.
- Actor, trip, membership, and permissions may be reused only through an explicit request-scoped context. Never retain that context in module globals or share it between requests.
- Recommendation lists are filtered, counted, ordered, and paginated in D1. Place options are fetched only for the recommendation IDs returned on the current page.
- New database indexes require an `EXPLAIN QUERY PLAN` finding that an important production-shaped query performs an avoidable full table scan. Index migrations must be additive and backwards compatible.
- Static hashed assets may use immutable public caching. A future cache for shared, non-member content or image derivatives needs a separate privacy review.

## Performance regression baseline

- GitHub CI runs Lighthouse against Home, Trips, Planning, and Costs in a production-like local Worker. Thresholds are intentionally broad enough to detect material regressions without turning normal Lighthouse variance into flaky failures.
- Map is recorded separately because AMap SDK, route services, WebGL, and tiles are third-party dependencies. Map results must not be compared directly with ordinary pages.
- Production Core Web Vitals use Cloudflare Web Analytics. Only aggregate LCP, INP, and CLS are required; do not add a custom analytics backend or collect additional personal data for performance measurement.
- D1 statement-count regression tests remain part of the automated suite. Production statement counts must not be invented from browser traces.

## Future media contract

- D1 stores media metadata and stable Trip, Day, Member, and Place relationships. R2 stores binary objects.
- Upload flow is browser -> short-lived upload authorization -> direct R2 upload. The Worker must not proxy complete image or video bodies.
- Originals may remain in R2. Pages load Cloudflare Images or image-transformation derivatives sized for `thumbnail`, `card`, and `display`; gallery/list views must not batch-load originals.
- Large videos use multipart upload. R2 creation, upload UI, processing, and gallery implementation are explicitly outside this contract task.

## Animation and heavy-client rules

- Primary above-the-fold content must not wait for decorative animation.
- Prefer CSS `transform` and `opacity`; always support `prefers-reduced-motion`.
- Motion, GSAP, and similar libraries are dynamically loaded only where the interaction needs them.
- WebGL and Three.js do not enter the default initial-page dependency graph.
- Map, gallery, editors, and other heavy components continue to load by active view or user interaction.
- A visual effect must not materially increase initial client JavaScript or block LCP. Measure it against the CI and production baselines before release.

## Deferred condition

D1 read replication is not enabled by default. Evaluate Sessions API plus read replication only after this work is deployed and repeated production measurements still show Worker/D1 TTFB as the dominant bottleneck.
