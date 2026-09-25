# Security Policy

## Supported versions

Neriva is pre-1.0. Security fixes land on the `master` branch; deploy the latest release reference to receive
them.

## Reporting a vulnerability

Please do not report security issues in public issues or pull requests.

Use GitHub's private reporting instead: open the repository's **Security** tab and choose
**Report a vulnerability**. Include the affected version or commit, the steps to reproduce and the impact you
observed.

You can expect an acknowledgement within a few days and a status update as the fix progresses. Please give us
reasonable time to fix the issue before disclosing it publicly.

## Scope

Especially relevant areas:

- authentication, refresh tokens and the forced first-login password change;
- authorization: CASL abilities, role scopes and tenant scoping of every query;
- Block templates: escaping of interpolated values and sanitization of authored HTML and CSS;
- the public delivery API, which must only expose published content;
- media uploads and file serving;
- trusted-proxy handling (`TRUST_PROXY`) and rate limiting.

## Deployment hardening

Operators should follow [docs/deployment.md](docs/deployment.md) and
[docs/production-readiness.md](docs/production-readiness.md): set a strong `JWT_ACCESS_SECRET` and initial admin
password, keep PostgreSQL and the API off the public internet, and restrict `TRUST_PROXY` to the proxy network.
