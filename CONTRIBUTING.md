# Contributing to Neriva

Thanks for taking the time to contribute. Bug reports, ideas and pull requests are all welcome.

## Before you start

- **Bugs:** open an issue with the steps to reproduce, what you expected and what happened. Include the request
  and the `application/problem+json` response when the API is involved.
- **Features:** open an issue first. Neriva is spec-driven, so new features start as a discussion and a spec.
- **Security issues:** do not open a public issue. See [SECURITY.md](SECURITY.md).

## Development setup

```bash
pnpm install
pnpm dev
```

See [Quick start](README.md#quick-start) for the URLs, the admin credentials and the flags.

## How changes are made

1. **Read the constitution.** [`CLAUDE.md`](CLAUDE.md) describes the principles, stack and conventions, and
   [`docs/specs/`](docs/specs) has one spec per feature. Architecture decisions live in [`docs/adr/`](docs/adr).
2. **Spec before code.** A new feature starts as a spec in `docs/specs/` and a change to the OpenAPI contract.
3. **Keep it headless-first.** Anything the Admin UI can do must be possible through the REST API.
4. **Scope every query by tenant.** No query without `tenantId`, even though v1 ships one tenant per deploy.
5. **Regenerate the contract** after touching controllers or DTOs:

   ```bash
   pnpm --filter @neriva/api openapi:generate
   pnpm --filter @neriva/contracts generate
   ```

6. **Keep the verification loop green:** `pnpm verify` runs lint, typecheck, tests and build.

## Commits and pull requests

- Commits follow [Conventional Commits](https://www.conventionalcommits.org) and are written in English.
- In the pull request, link the spec or issue, describe the change and how you tested it, and include screenshots
  for Admin UI changes.

## License

By contributing, you agree that your contributions are licensed under the [MIT License](LICENSE).
