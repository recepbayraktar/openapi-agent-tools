# Publishing

This package is published to npm only.

## Required Secrets (GitHub Actions)

- `NPM_TOKEN`: npm automation token with publish permission

## Automated Release (Recommended)

Workflow: `.github/workflows/release.yml`

Trigger options:

- Push a tag like `v0.1.0`
- Run workflow manually with a version input

Pipeline steps:

1. Install and validate (`typecheck`, `lint`, `test`, `build`)
2. Publish via `pnpm publish --access public`
3. Create GitHub Release for tag-based runs

## Manual Publish

```bash
pnpm install
pnpm test
pnpm build
pnpm publish --access public
```

## Notes

- `publishConfig.access` is set to `public` in `package.json`.
- No GitHub Packages registry override is used in this repository.
