# @speleodb/api agent instructions

This repository is the standalone TypeScript SDK for SpeleoDB. Read
[docs/maintenance.md](docs/maintenance.md) before changing the contract,
generator, runtime, dependencies, or release configuration.

## Supported API scope

SpeleoDB's obsolete `/api/v1` API is deliberately unsupported. Never add its
operations, compatibility wrappers, aliases, or examples to this SDK. The
backend may still serve those routes; their presence is not permission to
generate clients for them.

The exclusion is an exact mount-prefix rule: discard a path only when it equals
`/api/v1` or starts with `/api/v1/`. Do not search for the substring `v1` or use
a generic version-number filter. Authentication routes such as
`/_allauth/browser/v1/config` and `/api/auth/app/v1/config` remain supported.
Paths beginning `/api/v10/` are not part of the excluded mount either.

`scripts/openapi-scope.mjs` applies this rule to the verified source document
before Orval runs. The response/form metadata projectors also apply it. The
independent wire-test inventory performs its own exact-prefix exclusion, and a
real generator fixture verifies that obsolete SpeleoDB routes disappear while
both authentication mounts remain. Preserve these protections even if today's
canonical backend export already excludes obsolete routes.

## Generated TypeScript must only be regenerated

**Never manually edit, patch, format in isolation, or search-and-replace files
in `src/generated/` or `src/form-data.generated.ts`.** They are generated
artifacts, including operation functions, DTOs, response metadata, and form
wrappers.

Fix backend schema generation when its contract is inaccurate. Fix
`orval.config.mjs`, `scripts/`, or the handwritten `src/runtime/` when
generation or transport adaptation is inaccurate. Then run `bun run generate` to
replace generated artifacts. Add a regression for the cause. Do not repair a
generated file after generation or suppress drift checks to make it pass.

`bun run generate:check` reproduces output in an OS temporary directory and
compares both filenames and bytes. CI and the `generated-sdk-sync` prek hook
enforce this rule. A failing drift check requires regeneration from the correct
source; it does not authorize editing generated files.

## Canonical schema and provenance

The web backend owns the only checked-in `OpenAPI.yaml`. Do not add a schema
copy to this repository or its npm archive. `openapi-source.json` records the
actual immutable backend commit and the SHA-256 of its complete canonical bytes.
Never invent a revision, use a branch as a revision, or hash the filtered SDK
projection instead of the canonical file.

`scripts/openapi-source.mjs` verifies the complete canonical bytes before any
scope filtering or generation. Published generation downloads the pinned
`OpenSpeleo/SpeleoDB` revision. Unpublished local work requires an explicitly
supplied absolute `SPELEODB_OPENAPI_PATH` and a matching digest. A null revision
is allowed for local work only; release requires the real published revision.
Never discover a schema through relative sibling/ancestor paths.

The filtered input exists only in the generation process's disposable directory.
It does not replace the canonical backend file or change the meaning of its
provenance hash. Keep schema bytes, temporary fixtures, review notes, and task
tracking outside the checkout.

## Standalone development and verification

Use Bun 1.4.2 and the exact pinned Orval version. Preserve the standalone
manifest, `bun.lock`, CI, and registry-based consumer behavior. Do not introduce
monorepo-only dependency specifications, relative imports into another
repository, root dependency installation, or cross-repository check dispatchers.

From this repository, install with
`test -s bun.lock && bun install --frozen-lockfile`. Follow the full commands in
the maintenance guide: review the source contract, regenerate, review generated
changes, run generation/type/lint/format checks, run the full test suite and
build, then run `prek run --all-files`. Never install hooks. Preserve runtime
coverage thresholds and exhaustive operation/status/media coverage. HTTP
serialization witnesses do not replace real backend contract tests.

Release only through the existing trusted-publishing CI with a reviewed,
published backend revision. Git mutations, tags, pushes and publication require
the user's explicit authorization; a review or implementation request alone is
not authorization. Preserve existing staged/unstaged work and temporary files.
