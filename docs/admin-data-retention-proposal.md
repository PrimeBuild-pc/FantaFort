# Proposed admin-data retention policy

Status: proposal only. It is not approved for production and migration `190009` does not delete historical records.

## Retention matrix

| Dataset | Online detail | Aggregate/archive | Proposed disposal |
|---|---:|---:|---|
| Administrative audit | 24 months | Optional immutable export beyond 24 months | Partition expiry by database owner after export and approval |
| Complete client errors | 30 days | Daily aggregates for 90 days | Delete only expired `app_errors` detail after aggregation |
| Aggregated client errors | 90 days | None by default | Drop expired daily aggregate partitions |
| Action request/idempotency registry | 12 months | Audit event remains under its 24-month policy | Expire a future registry partition; never edit an audit row |

## Audit implementation proposal

The current audit table is append-only and must remain so for application and service roles. Row-level cleanup would conflict with that guarantee. Before enforcing 24-month disposal:

1. introduce time partitions in a separately reviewed migration;
2. keep the append-only trigger on active partitions;
3. export an expiring partition to an immutable, access-controlled archive when required;
4. verify record counts and export checksum;
5. let a database-owner maintenance job detach/drop the entire expired partition;
6. append a maintenance attestation outside the expiring partition.

No admin route may delete or update audit rows.

## Client-error implementation proposal

- Keep redacted `app_errors` detail for 30 days.
- Add a daily aggregate keyed by date, normalized path, error fingerprint and count; do not copy stack, email, token, cookie or UUID values into it.
- Aggregate before deleting detail.
- Retain aggregates for 90 days using date partitions or a bounded maintenance function callable only by the scheduler owner.
- Keep the existing per-user ingestion rate limit and output redaction.

## Idempotency implementation proposal

The current unique keys live in `admin_audit_log`, so they inherit audit retention. To enforce an independent 12-month replay window, a future migration should:

1. create a dedicated, partitioned idempotency registry containing actor reference, action, a one-way key hash, payload fingerprint, result reference and expiry;
2. make each mutation reserve the registry key in the same transaction as its domain change and audit insert;
3. preserve the corresponding immutable audit event for 24 months without storing the raw idempotency key;
4. expire registry partitions after 12 months by database-owner maintenance.

Until that redesign is approved, idempotency keys remain longer than 12 months; weakening replay protection is not acceptable.

## Periodic staging reset

Use `docs/staging-reset.md`. The identity gate must verify the approved staging project/ref/hostname and explicitly reject production before `supabase db reset --linked --no-seed`. Reset is an environment rebuild, not an application bypass: no temporary ledger/audit trigger changes or deletion RPCs are permitted.

## Review gates

Before production adoption, obtain privacy/legal approval, define archive access, test partition operations on production-scale staging data, document restore evidence and alert on failed aggregation/export/expiry jobs.
