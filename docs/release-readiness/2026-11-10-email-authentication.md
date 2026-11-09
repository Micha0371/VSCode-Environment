# SMTP sender authentication — 2026-11-10

Status: public DNS and controlled Gmail receiver verification passed for
`auth.householdkit.app`. This closes the sender-authentication follow-up; it does
not establish deliverability to every provider or overall production readiness.

## DNS correction

Authoritative DNS initially returned Cloudflare proxy IPs for the sending names
and no DMARC record. The owner set the existing CNAMEs to DNS only, retained
their provider targets, and added the auth-subdomain DMARC TXT record.

| Record | Verified result |
| --- | --- |
| `send.auth.householdkit.app` | CNAME `send.forge.rmta.net`; SPF resolves through the provider chain |
| `rsend.auth.householdkit.app` | CNAME `rsend-euw1.forge.rmta.net`; SPF includes `amazonses.com`; MX resolves to the provider's EU-West feedback service |
| `resend._domainkey.auth.householdkit.app` | DKIM public key remains published |
| `_dmarc.auth.householdkit.app` | TXT `v=DMARC1; p=none;` |

SPF and DMARC were visible through both Cloudflare and Google public resolvers.
No root-domain DMARC policy was added; this change is scoped to the auth sender.

## Fresh-message receiver evidence

One controlled confirmation message was sent through Supabase's configured
custom SMTP service after the DNS changes, at 00:45 Berlin on 10 November
(23:45 UTC on 9 November). The owner supplied Gmail's Show original results:

| Check | Verdict | Relevant domain |
| --- | --- | --- |
| SPF | PASS | Envelope sender under `rsend.auth.householdkit.app` |
| DKIM | PASS | `auth.householdkit.app`, selector `resend` |
| DMARC | PASS | Header From domain `auth.householdkit.app` |

The observed sender was PantryFlow, `noreply@auth.householdkit.app`. The agent
independently checked public DNS; receiver verdicts came from the owner's
supplied headers. Raw headers, recipient addresses, message IDs, signatures and
confirmation tokens are not retained in this record.

The message was for header inspection only. Its exact generated account and
empty, unshared household were removed with identity, relation and aggregate
checks. Three owner-preserved manual-test accounts/households and the single
pantry item remained unchanged. The obsolete generated password was removed.
Sanitized local evidence is ignored at
`pantry-flow/.verification/release-readiness/header-test-result.json`.

## Policy limit

`p=none` does not request quarantine or rejection of failing messages. No
aggregate-report destination is configured. Assess legitimate senders and a
usable reporting destination before considering stricter enforcement as a
separate change. No automatic escalation or paid service is required here.

PR #3 is merged. Real SMTP callback/session/restart acceptance and a physical
force-stopped cold start passed. That cold start used normal initial routing
(`recovered: false`); physical execution of the timeout fallback is not claimed.
Its deterministic delayed-bridge regression is separate evidence.
