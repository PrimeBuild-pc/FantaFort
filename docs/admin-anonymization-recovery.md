# Anonymization retry and compensation

Anonymization is disabled unless all three server flags permit it. It never hard-deletes an Auth user, profile, wallet, ledger or admin audit record.

## Preconditions

- target is a suspended, non-admin synthetic account;
- administrator JWT is verified at AAL2;
- one-use `anonymize` step-up grant is valid;
- operator reviewed the current impact preview and sends its fingerprint;
- operator confirms the exact current email or UUID;
- active/lobby league dependencies are resolved;
- linked Auth providers other than email/phone require manual privacy review and are rejected.

## Ordered phases

1. Re-read account and impact preview server-side.
2. Verify the preview fingerprint and confirmation.
3. Replace Auth email, optional phone, password and user metadata with synthetic values and keep the Auth account banned.
4. In one database transaction consume the step-up grant, remove mutable communication/watchlist/error data, pseudonymize the profile and append the success audit.
5. Preserve profile ID, relational references, wallet, wallet ledger and audit history.

## Retry matrix

| Failure | Result | Retry |
|---|---|---|
| Auth update fails | Database remains suspended and unchanged; failed Auth phase is audited. | Retry the same operation after resolving Auth availability. |
| Auth succeeds, DB fails | Auth remains anonymized and banned; profile remains suspended; failed DB phase is audited. | Retry using UUID confirmation and a fresh AAL2 step-up. The operation continues forward; it does not restore PII. |
| DB commits, response is lost | Profile status is already `anonymized`; ledger/audit remain intact. | Re-read the account and confirm its UUID. The route returns an idempotent success without repeating Auth mutation. |
| Impact changes before DB lock | Operation is rejected as stale before mutation. | Reload and explicitly review the new preview. |

## Compensation rule

Compensation is forward-only. After Auth PII has been replaced, the application must never restore the original email, phone, password or metadata automatically. A database failure therefore remains fail-closed: the Auth account is banned and the application profile is still suspended until a reviewed retry completes.

Do not use SQL bypasses, disable append-only triggers or delete ledger/audit rows during recovery.
