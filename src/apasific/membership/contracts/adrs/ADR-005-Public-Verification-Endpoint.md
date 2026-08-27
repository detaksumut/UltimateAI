# ADR-005: Public Verification Endpoint

**Status:** Accepted
**Date:** 2026-07-10

## Context
APASIFIC generates digital artifacts (Digital Member Cards, e-Certificates) that external parties (universities, employers) need to verify without logging into the system.

## Decision
We establish a canonical, unauthenticated Public Verification Endpoint (`GET /api/v1/public/verify/{token}`). All digital artifacts will encode this URL as a QR code. The payload returned will strictly omit PII (like email or internal notes) and only expose Public Profile data.

## Consequences
- **Positive:** Centralizes verification logic. Guarantees GDPR compliance by strictly filtering public outputs at a single choke point.
- **Negative:** High traffic potential requires heavy caching (e.g., Redis) on this specific endpoint.
