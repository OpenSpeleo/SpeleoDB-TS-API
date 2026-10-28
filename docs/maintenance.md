# Maintaining @speleodb/api

This package makes the web application's executable API contract available to
TypeScript consumers. The SDK owns its checked-in schema snapshot; Orval owns
generated code; the SDK runtime owns transport adaptation. Changes should
preserve these boundaries so an endpoint correction benefits every consumer.

## Prerequisites and ownership

Use Bun **1.4.2**, pinned by `.bun-version`, `packageManager`, and
`engines.bun`. Orval **8.43.0** is an exact development dependency. The SDK has
its own manifest, lock, tests and validation workflow and works outside the
monorepo. Never install Git hooks as part of setup.

Run hooks explicitly with `prek run --all-files`. JavaScript hooks execute with
Bun; ESLint delegates to the package's `bun run lint` and its locked
dependencies. Keep the Prettier hook revision aligned with the package's
Prettier version when updating either, so local checks and hooks apply the same
formatter.

| File or directory              | Owner and purpose                                                       |
| ------------------------------ | ----------------------------------------------------------------------- |
| `OpenAPI.yaml`                 | Reviewed local OpenAPI snapshot used for SDK generation                 |
| `openapi-source.json`          | SHA-256 of the complete local snapshot                                  |
| `orval.config.mjs`             | Pinned generator configuration and output layout                        |
| `scripts/openapi-source.mjs`   | Loads and verifies the package-local schema snapshot                    |
| `scripts/openapi-scope.mjs`    | Excludes only the obsolete SpeleoDB `/api/v1` mount from SDK generation |
| `scripts/openapi-metadata.mjs` | Derives response decoding and form field policies from the snapshot     |
| `src/generated/`               | Orval output; regenerate instead of editing                             |
| `src/form-data.generated.ts`   | Generated form mutator wrappers; regenerate instead of editing          |
| `src/runtime/`                 | Handwritten, framework-neutral HTTP runtime and regression tests        |
| `src/index.ts`                 | Public source exports                                                   |
| `bun.lock`                     | Standalone package dependency graph                                     |

Endpoint paths, parameter names and API DTOs must not be duplicated in runtime
code. New application state, persistence models, offline queues and UI errors
remain in their owning applications. Do not add runtime dependencies on Django,
Capacitor or a frontend framework.

The public package exports TypeScript source. A consumer does not run a package
build first. `dist/` is disposable bundle/type smoke-test output, ignored by Git
and excluded from publication. `./package.json` and `./openapi-source.json` are
explicit exports for tooling. The npm archive also includes `OpenAPI.yaml`.
Application installs, builds and runtime calls use generated TypeScript.
Generation, CI and release use the checked-in snapshot without fetching another
repository or requiring a backend revision.

## Updating the local schema snapshot

`OpenAPI.yaml` is the SDK's complete generation input. Import a reviewed API
export manually when adopting a contract change, preserve its exact bytes, and
update `openapi-source.json` alongside it. This explicit import is the only
schema synchronization step. SDK generation and standalone CI never inspect
another checkout, fetch a backend file, or enforce equality with another
repository. The monorepo retains a local integration unit test comparing its web
snapshot, SDK snapshot and recorded digest. This integration gate belongs to the
monorepo; it does not introduce a dependency between standalone child CI jobs or
releases.

The imported export should describe actual endpoint behavior, including
supported authentication and OGC operations. Backend verification remains the
producer's responsibility; structural validation or successful SDK generation
does not prove endpoint correctness. SpeleoDB's obsolete `/api/v1` mount is
intentionally excluded from this SDK; authentication's own `/v1` routes remain
supported.

### Exact SDK scope and generated-source ownership

The SDK applies its own scope filter even if the supplied backend export still
contains obsolete SpeleoDB operations. A path is excluded only when
`path === "/api/v1"` or `path.startsWith("/api/v1/")`. The rule retains
`/_allauth/browser/v1/...`, `/_allauth/app/v1/...`, `/api/auth/browser/v1/...`,
and `/api/auth/app/v1/...`. It also does not confuse `/api/v10/...` with the
obsolete mount. Never use a substring search for `v1` or remove all APIs whose
URLs contain that version segment.

`scripts/generate.mjs` first loads and hash-verifies the complete local
snapshot. Only afterward does `scripts/openapi-scope.mjs` create the document
passed to Orval. This filtered document is serialized as JSON, which is valid
YAML, inside the existing disposable generation directory. The checked-in
snapshot bytes are preserved. The SHA-256 in `openapi-source.json` always
describes the full original export, including any excluded paths; it never
describes this temporary projection. No filtered schema is checked in or
published.

The response and form metadata projectors apply the same production scope rule.
The test oracle independently applies the exact mount-prefix exclusion and
compares the resulting inventory with every exported generated callable. A real
Orval fixture includes obsolete SpeleoDB paths, both supported authentication
mounts, and a similar `/api/v10` prefix to protect these boundaries. This SDK
filter does not remove or alter any backend route.

All files under `src/generated/` and `src/form-data.generated.ts` must be
created through `bun run generate`. Never hand-edit an endpoint, DTO, generated
URL, form wrapper, or generated response metadata—even to fix a small type or
formatting error. Correct the local schema snapshot or the handwritten
generation inputs, regenerate, then review the result. CI and prek's
`generated-sdk-sync` hook run `generate:check`, which compares exact filenames
and bytes. A manual change must fail that check; do not disable the check or
preserve the manual change by copying it into a temporary generation fixture.

### Importing a reviewed export

From this SDK checkout, copy the reviewed export to `OpenAPI.yaml`. The source
may be an explicitly supplied file; no source repository location is configured
or discovered by the SDK. Preserve the export bytes rather than independently
serializing or formatting them. After reviewing the schema diff, record its
SHA-256:

```sh
bun -e '
import { createHash } from "node:crypto";
const bytes = await Bun.file("OpenAPI.yaml").arrayBuffer();
await Bun.write("openapi-source.json", JSON.stringify({
  sha256: createHash("sha256").update(new Uint8Array(bytes)).digest("hex"),
}, null, 2) + "\n");
'
bun run generate
```

`openapi-source.json` contains only `sha256`, the 64-character lowercase digest
of the complete local snapshot. There is no backend revision, remote URL, or
schema-path override. A missing snapshot or digest mismatch fails generation;
the loader never downloads a substitute or silently updates the digest.

Review and commit the schema snapshot, digest and regenerated SDK together when
Git actions are authorized. Each SDK release carries its own reproducible
contract. Backend, SDK and consumer repositories validate their own artifacts;
none waits for another repository to publish a matching schema revision.

## Regenerating and reviewing a contract change

From the SDK checkout:

```sh
test -s bun.lock && bun install --frozen-lockfile
bun run generate
bun run generate:check
bun run typecheck
bun run lint
bun run format:check
bun run test
bun run build
bun pm pack --dry-run --ignore-scripts
```

`bun run check` combines generation drift, types, lint, tests and the smoke
build. `generate:check` generates in an OS temporary directory and compares
filenames and bytes. It never repairs checked-in output. If it fails, regenerate
locally, review the change and rerun it; do not weaken the comparison or edit
generated files to make the check pass.

Review the source-schema diff before the generated diff. Each changed operation
needs an accurate method/path, stable operation ID, parameters, request media,
response statuses/media and wire models. Required, nullable, omitted, read-only
and write-only fields are separate concepts. Empty bodies, redirects, binary
downloads and HTML/non-JSON failures must not be described as ordinary JSON
DTOs.

The generator emits a function for each request representation when an operation
has multiple media types: `WithJson`, `WithFormData` and `WithUrlEncoded` are
explicit variants. A single representation keeps the base operation name. Choose
the variant matching actual server parsing. File uploads use a typed File/Blob
body and multipart generation; JSON serialization cannot carry bytes. Do not
advertise a binary upload under urlencoded media merely because a generic
framework parser is installed.

Git protocol uploads have opaque binary variants such as
`WithXGitUploadPackRequest`, `WithXGitReceivePackRequest`, and `WithBlob`. The
wildcard request representation uses `WithContent`. Supply Blob bytes directly;
generated code must not JSON-stringify a packet-line stream. A wildcard in
OpenAPI describes accepted media, not a literal HTTP `Content-Type`. The runtime
uses a Blob's concrete media type for that variant, falling back to
`application/octet-stream`; an explicit concrete per-call header takes
precedence. Response MIME ranges likewise match actual concrete response
headers, and declared binary streams stay Blob values even if their concrete
header contains `json` or begins with `text/`.

The configuration derives operation decoding metadata from the supported paths
of the verified snapshot. Do not maintain a second endpoint table, generate
metadata from stale schemas, or patch URLs after generation. Orval upgrades can
alter names, optionality, serialization and generated runtime calls even when
schema bytes are unchanged; review upgrades as SDK changes and exercise
representative consumer calls.

Orval 8.43's default multipart serialization for `oneOf`/`anyOf` request bodies
references Node's Buffer type. Its field serializer also passes nested objects
and primitive unions directly to form append methods, which cannot accept them.
All form operations use Web API-only `unionFormData` and `unionUrlEncoded` body
mutators. Generation creates operation-specific wrappers in
`src/form-data.generated.ts` because Orval passes only the body to a form
mutator. These wrappers derive nullable-field policies from the media-specific
schema; they contain no manually maintained endpoint list. `generate:check`
compares these wrappers as well as Orval's operation/model output.

An omitted or `undefined` field stays omitted. Explicit `null` becomes an empty
form value only for fields marked `x-drf-null-as-empty: true`, which the backend
exporter sets when DRF interprets that value as a clear. Other nulls throw
before transport, rather than silently preserving stale server state. JSONField
form inputs are JSON-encoded strings in the schema: pass `JSON.stringify(value)`
(including the string `"null"` to encode JSON null). These strings are sent
unchanged. Arrays of ordinary form values use repeated fields, scalars become
strings, and multipart files preserve their bytes. Unsupported nested create
collections are excluded from form schemas; use the JSON variant instead.

Some form request unions permit a null field only in one member, such as a note
with no uploaded file versus a document requiring a file. The generated wrapper
retains every member's permitted empty-value null policy; the generated union
type still determines which payload is valid. `x-json-schema` documents the
decoded structure of a JSON text field while its actual generated input remains
a string. DMP Doctor therefore receives `data: JSON.stringify(configuration)` as
a text part, alongside the separate uploaded file. Do not convert such a field
to a JSON Blob or add a part content type: that changes how Django parses it.

If upgrading Orval, test omission versus clearing, JSON strings, primitive
unions, repeated values and file uploads in both form media before changing the
overrides. Do not patch generated files or add Node runtime requirements to
browser consumers.

For an Orval upgrade, update its exact `devDependencies` pin in `package.json`,
the version printed by the `orval.config.mjs` header, and the documented tool
version together. Resolve the SDK's standalone lock first, then the monorepo
integration lock. Regenerate even when `OpenAPI.yaml` is unchanged and review
operation names, model exports, body encoding, error/status unions, and browser
runtime imports. Run the SDK checks and both consumer builds/tests against the
new output before releasing it. A generator upgrade can require a consumer
migration without any backend change.

## Operation coverage and the runtime coverage gate

`bun run test` and `bun run test:coverage` run the same Vitest suite with the
Istanbul provider pinned to the exact Vitest version. Bun uses JavaScriptCore,
so V8 coverage is not interchangeable. The copied package CI invokes this same
covered test command; coverage is not an optional local-only command.

`tests/contract-cases.ts` reads the checked-in local schema through the same
hash-verifying source loader used by generation. It independently derives the
operation, parameter, request-media and response-status/media inventory.
`tests/generated-contract.test.ts` sends every generated callable through the
public SDK and real fetch to an owned loopback HTTP server. Currently this means
376 supported operations, 584 request-media callables and 1,869 declared
status/media cases. Each callable is checked against the entire canonical
response metadata, not only the response selected for its request test.
Undeclared statuses and media are tested for every operation as well.

The request assertions inspect bytes actually received by the server: escaped
paths, query values and omission, declared headers, JSON, URL-encoded fields,
repeated multipart fields, filenames, MIME types and UTF-8 file bytes. Response
witnesses verify decoding, status classification, response headers and binary
byte preservation. These payloads are serialization witnesses; they are **not**
evidence that invented business DTOs satisfy backend validation. Real endpoint
behavior and response-schema validity remain the web backend's responsibility
and are verified by its observed contract report and API tests.

Raw Git request witnesses contain NUL, invalid UTF-8 bytes, and ordinary UTF-8
text so accidental JSON serialization or string conversion cannot pass. Wildcard
response witnesses use concrete MIME types, including JSON and text headers over
opaque binary content. HTML authentication failures are exercised as text at
their documented status, rather than being treated as undocumented JSON errors.

Inventory assertions fail for missing or extra generated callables. The adapter
also fails on unfamiliar signature, media, parameter serialization or response
status shapes. When the schema grows, review the new wire contract, extend the
independent witness strategy if needed, and update the explicit inventory
counts. Do not skip new operations or derive expectations from generated code,
production serializers, or a second handwritten route registry.

Coverage measures only `request.ts`, `response.ts`, `browser.ts` and
`form-data.ts`. Generated DTO and operation line counts do not inflate the
runtime denominator; the canonical matrix proves operation coverage separately.
Each runtime file must retain at least 95% statements, branches and lines and
100% functions. These floors are enforced by the test command and CI. Read
`coverage/coverage-summary.json` and `coverage/lcov.info` after a run, and
inspect genuinely uncovered branches before changing the thresholds in
`vitest.config.ts`. Do not add ignore directives or lower a gate merely to make
new behavior pass. XHR event tests use an explicit adapter stub; real browser
upload behavior is additionally covered in web's browser suite. SDK loopback
fetch tests exercise actual redirects, disconnects and unfinished responses.

Schema-source tests cover local snapshot loading, digest failures, malformed
source records, missing files, generated filename drift, output preservation and
temporary-input cleanup when generation fails. The SDK suite and generator read
the same package-local snapshot. Neither requires network schema access, another
checkout, a backend revision, or a schema-path environment variable.

## Testing runtime changes

The runtime result distinguishes documented HTTP responses from unexpected
responses with unknown data. HTTP errors normally resolve; connectivity,
cancellation and decoding failures reject. Never replace status-based behavior
with blanket throwing or hide malformed responses under success DTO assertions.

Add tests at the real transport boundary for the changed behavior. Important
scenarios include independent clients and rotated credentials; path/query
encoding; JSON serialized once; multipart names, filenames, MIME types and file
bytes; response headers and binary data; empty 204/304; documented errors and
unexpected statuses; and invalid media/JSON.

Deadline and cancellation tests must cover header preparation, body conversion,
transport, response parsing and ignored late completion. The transport receives
the remaining deadline plus the caller-owned signal. An adapter must not restart
a full deadline after asynchronous preparation.

The default client deadline is ten seconds. `timeoutMs: null` explicitly
disables it, including during asynchronous header preparation; caller
cancellation remains active and must suppress late completion. An omitted
per-call option inherits the client policy, while an explicit finite value can
restore a deadline for one operation. Do not use truthiness or
nullish-coalescing defaults here: `null` and `undefined` have distinct meanings.
Zero, negative, nonfinite and excessively large numeric durations remain
invalid. Transports receive either the remaining finite milliseconds or `null`;
XHR represents the latter with its documented zero timeout. A transport that
cannot honor this policy must reject it clearly.

The web application opts out of a client deadline to preserve its established
large-file uploads and conversions; explicit polling cancellation still applies.
Mobile continues to configure a finite deadline and rejects unbounded requests
at its adapter boundary. Keep these application policies separate when changing
the SDK default. Test completion beyond ten seconds, cancellation of an untimed
request, and finite overrides on untimed clients.

Merge headers case-insensitively with last-value precedence: client headers,
generated content-type defaults, then explicit per-call headers. Orval can emit
an object with both `Content-Type` and `content-type` keys when a caller
supplies a `Headers` object. Passing that object directly to the `Headers`
constructor would comma-join the values and produce an invalid request media
type. Preserve the runtime's entry-by-entry merge and test generated JSON and
urlencoded calls with records, tuple lists and `Headers` instances after
generator upgrades.

Browser upload tests distinguish progress, upload completion and response
completion. XHR cannot enforce cookie omission or redirect refusal and must
reject those policy combinations. Our XHR adapter waits for the complete
response before inspecting its status, so it also rejects
`responsePolicy: 'status-first-json'` before constructing or sending a request.
Keep regressions for explicit XHR selection and both upload callbacks with an
untimed client: denial bodies must never silently become an indefinite wait. Do
not fall back to fetch while silently dropping upload observers. Native adapters
retain their own transport and device verification: ordinary TypeScript tests
cannot prove cookie isolation inside an iOS/Android HTTP stack or cancellation
on physical devices. In mobile, retain GIS status-before-body behavior and
existing session/offline persistence regressions.

The public generated options argument remains optional due to the fetch
generator's signature, but an ApiClient is required at runtime. Do not introduce
a global default client to conceal a missing caller context. Applications should
pass their client explicitly and resolve credentials at request time.

`ApiRequestOptions` exposes the supported method, body, headers, credentials and
redirect fields plus SDK cancellation/deadline/progress options. Arbitrary fetch
options are not advertised by this transport-neutral interface. Extend the
transport contract and each affected adapter deliberately before adding another
request policy.

## Dependencies and monorepo integration

Resolve the SDK's standalone lock outside the enclosing Bun workspace; otherwise
a successful install can validate only the parent graph. `bun run lock` in a
monorepo checkout uses the existing shared lock utility. In a standalone
checkout use Bun's lock-only workflow, then verify a frozen install in a clean
temporary copy. Update the root integration lock separately using root
`bun run lock`.

Each consumer keeps an exact registry version for standalone use. Monorepo
overrides resolve the live SDK source; application source imports must declare
`@speleodb/api` directly. Refresh root `bun.lock`, affected standalone consumer
locks, and the web container overlay lock whenever the dependency graph changes.
Run application checks from their own repositories. Do not add root check
dispatchers or mutate standalone manifests to workspace-only dependency ranges.

## Versioning and release integration

Treat removed operations, renamed exports, newly required inputs, narrowed
response types and incompatible runtime behavior as breaking changes. Additive
operations or optional fields can be a minor release; behavior-preserving fixes
can be patches. While the package is `0.x`, communicate breaking changes clearly
and use a new minor version rather than quietly shipping them as a patch.

### Updating from 0.5.0 to 0.5.1

The packaged OpenAPI snapshot restores the existing cylinder and sensor
installation `status` (`installed`) and landmark `collection_type` (`SHARED`)
defaults. These annotations describe existing model and serializer behavior;
request handling, generated operation signatures, and Stalagmight support remain
unchanged.

### Migrating from 0.4.x to 0.5.0

Project responses can now return `STALAGMIGHT` in their `type` field. Include
this value in exhaustive project-type handling. Project creation and updates
accept the new choice case-insensitively, matching the existing project types.
This release adds project classification; it does not add a Stalagmight survey
converter or a new upload operation.

### Migrating from 0.3.x to 0.4.0

GIS View management models now expose the optional nullable `geographic_bound`
geometry UUID. Omit it on update to preserve the selection, or send `null` to
clear it. Public metadata exposes the selected Polygon, revision, color and
alias through `PublicGISGeographicBound`. Geometry deletion also declares a 400
response when a GIS View references the geometry.

This setting clips only the public web display; signed GeoJSON downloads and OGC
data remain unrestricted. Existing views default to no bound. Consumers that use
exhaustive response-status handling must account for the new deletion response.

### Migrating from 0.2.x to 0.3.0

This release corrects the generated contract to match existing backend behavior.
Several corrections change callable signatures and required inputs, so consumers
must migrate before adopting the new exact package version.

DRF's optional `format` query selector now appears even on endpoints whose only
machine renderer is JSON. Where a function previously had no query parameters,
Orval inserts an optional `params` argument before the final request options.
Pass `undefined` when no query parameters are needed; the client still belongs
in the final argument:

```ts
// 0.2.x
await v2ProjectsList({ client });

// 0.3.0
await v2ProjectsList(undefined, { client });
// Or explicitly select the documented machine renderer:
await v2ProjectsList({ format: "json" }, { client });
```

The same rule applies after path and body arguments for writes. Inspect each
generated signature rather than adding an argument to authentication functions
or to an operation that already had a query-parameter object. Keep all existing
query values in that object. Review runtime call sites as well as type errors:
passing options into a newly inserted query slot can otherwise encode them in
the URL and leave the actual call without its client.

File-only endpoints no longer advertise JSON or URL-encoded request variants
that cannot carry the required uploaded file. When only multipart remains, Orval
uses the base operation name—for example `v2GisLayersCreate` replaces the
previous `v2GisLayersCreateWithFormData` callable. Import the surviving
generated function and pass File/Blob values through its typed body. Optional
file fields on other endpoints retain their supported representations; choose
from the actual generated signatures.

Input corrections require the saved `expected_revision` when updating GIS
geometry, including PATCH; retain the revision obtained when loading the
geometry instead of inventing one. Experiment record creation and replacement
must include every required editable field, including Measurement Date, while
PATCH merges existing values. The server owns submitter identity. Station
resource creation now distinguishes a note with nonempty text from a photo,
video, or document with a required uploaded file. Form schemas exclude nested
create collections that the backend cannot parse; use the JSON variant to send
those collections. Project and other server-owned creator fields no longer
appear as writable inputs.

Experiment record responses also permit nonempty string arrays for values
created through form requests. This widening applies only to responses; JSON
writes still accept the documented scalar field values. The current backend
preserves the submitter email as an array on form-created records, which causes
later PUT/PATCH validation to fail. Use JSON creation for records that must
remain editable; the SDK reflects this existing behavior without normalizing the
returned data.

Browser authentication errors now include documented HTML responses, and
framework negotiation/parser failures appear at their actual statuses. After
narrowing `kind` and `status`, inspect `typeof result.data` when a status
permits both JSON and text. Do not assume every documented error is an object.
Binary results, redirects, nullable clears and JSON-encoded text form fields
preserve their actual wire representation.

The SDK also includes the canonical `/api/auth/...` authentication aliases, Git
smart-HTTP operations and machine-discovery endpoints. These additions do not
restore obsolete SpeleoDB `/api/v1` support. Authentication's own `v1` segments
remain supported. The generator continues to exclude only the exact obsolete
SpeleoDB mount.

Update each standalone consumer's exact dependency to `0.3.0` after publication,
refresh its own lockfile, then run its types, tests and build outside the
monorepo. Do not edit generated SDK files or weaken the source contract to
preserve an outdated application call signature.

### Migrating from 0.1.x to 0.2.0

Cylinder installation creation now requires `project` in JSON, multipart and
URL-encoded inputs, matching the backend's non-null project association. Include
the existing project identifier when creating an installation; PUT/PATCH
continue to allow omission to preserve the current association. Downloads at a
specified revision now recognize JSON 400, 422 and 500 responses as documented
results. Narrow the response by `kind` and `status` as usual. The XHR adapter
now rejects `status-first-json` before sending; use fetch without upload
observers when that response policy is required.

These corrections require the 0.2.0 minor release because creation inputs are
stricter. Update the exact package pin and standalone lock in each consumer,
then run its own types, tests and build against the published package. The SDK
retains its reviewed local schema snapshot.

### Release coordination

The SDK version in `package.json` is independent of the backend version in
OpenAPI's `info.version`. Do not edit the local schema solely to bump the SDK
version; its digest continues identifying the reviewed snapshot bytes.

A schema correction can break generated source types even when it merely makes
existing server behavior honest. Review consumer compilation and runtime
effects, and document the before/after contract. Never retain an inaccurate
schema simply to avoid a consumer migration.

Verify the SDK against its checked-in schema and publish through its version tag
and trusted publishing workflow. Backend publication is not an SDK release gate.
After the SDK release is available, update standalone consumer pins and locks
and verify those applications. Publishing, commits, pushes and parent pointer
updates are separate explicitly authorized actions. Pushing an SDK `v*` tag
triggers publication when all gates pass; ordinary branch pushes and pull
requests only validate.

Before a version is published to npm, a live monorepo build does not prove a
standalone release can install it. This also applies to the initial `0.1.0`
release. Validate an explicitly reviewed package archive in an isolated consumer
copy, or wait for the authorized registry release. Never fabricate registry
integrity, URLs or revisions, and do not represent unpublished-consumer lock
failures as successful release verification.

Before publication inspect `bun pm pack --dry-run --ignore-scripts`. The package
contains source, `OpenAPI.yaml`, its digest record, README, maintenance
documentation and license; it excludes node_modules, ignored dist output,
coverage, credentials and agent working files. Verify exported paths exist
inside the archive. A source package must be tested through an installed archive
as well as a workspace source link.

For a concrete source-only archive smoke test, first run the SDK checks above,
then use an empty directory outside all workspaces. Substitute the version in
the archive filename when the package version changes:

```sh
archive_dir="$(mktemp -d)"
bun pm pack --destination "$archive_dir" --ignore-scripts
mkdir "$archive_dir/consumer"
cd "$archive_dir/consumer"
printf '{"name":"sdk-smoke","private":true,"type":"module"}\n' > package.json
bun add "$archive_dir/speleodb-api-0.5.1.tgz"
bun add --dev typescript@6.0.3
cat > smoke.ts <<'TS'
import { createApiClient, v2ProjectsList } from '@speleodb/api';

const client = createApiClient({
  baseUrl: 'https://example.test',
  transport: async () => ({
    status: 200,
    data: [],
    headers: new Headers({ 'content-type': 'application/json' }),
  }),
});
const response = await v2ProjectsList(undefined, { client });
if (response.kind !== 'documented' || response.status !== 200) {
  throw new Error('Archive operation failed');
}
TS
bun ./node_modules/typescript/bin/tsc --noEmit --strict \
  --target ES2023 --module ESNext --moduleResolution bundler \
  --lib ES2023,DOM smoke.ts
bun smoke.ts
```

The custom transport keeps this check independent of any live user service.
Inspect the tarball with `tar -tzf` and verify `package/src/index.ts`,
`package/OpenAPI.yaml`, `package/openapi-source.json`,
`package/docs/maintenance.md`, README and license exist. This smoke check does
not replace installing the reviewed archive into isolated web/mobile copies and
running their own tests and builds before release.

### Trusted publishing setup and release

The complete `.github/workflows/ci.yml` follows the same workflow as
`@speleodb/map-core` and `@speleodb/map-viewer`, with SDK generation added. It
uses Bun for frozen installation, lint, formatting, types, tests and builds.
Only the tag's publishing job sets up Node 24 and npm for GitHub OIDC. This
release-only exception does not introduce a Node runtime requirement or npm
lockfile for development or consumers.

Before a release, configure the GitHub repository's `publish` environment and
the npm package's GitHub Actions trusted publisher with these exact values:

| Setting           | Value                      |
| ----------------- | -------------------------- |
| Package           | `@speleodb/api`            |
| Organization      | `OpenSpeleo`               |
| Repository        | `SpeleoDB-TS-API`          |
| Workflow filename | `ci.yml`                   |
| Environment       | `publish`                  |
| Label             | `github`                   |
| Allowed action    | Allow direct `npm publish` |

The publishing job requests `contents: read` and `id-token: write`; it does not
read an npm write-token secret. The workflow filename is the filename alone, not
`.github/workflows/ci.yml`. Keep the repository URL in `package.json` aligned
with the actual upstream. The values are case-sensitive. npm requires a newly
created trusted publisher to complete its first successful publish within two
days; recreate an expired configuration before retrying. See npm's
[trusted publishing documentation](https://docs.npmjs.com/trusted-publishers/)
for setup and troubleshooting.

For the initial `0.1.0` release, confirm npm provides the package's settings and
permits this trusted publisher to be configured. A registry `404` or successful
local login does not establish this prerequisite. If the new package cannot yet
be configured, finish the registry's required initial setup before a release tag
is pushed. Keep that unresolved setup explicit; do not add a token-based
publication fallback or a placeholder package to bypass it.

Run `bun run check` against the checked-in snapshot before tagging. CI uses the
same package-local schema and rejects missing files, digest mismatches or
generated drift before the publish job can run. No backend repository or
publication order is required for these checks.

After the required tests and repository-local prek checks pass, inspect the
reviewed archive and commit the same source and documentation. When publication
and Git actions are authorized, push the reviewed SDK commit and its
`v<package.json version>` tag to its own upstream. For version `0.5.1`, the tag
must be `v0.5.1`; the workflow rejects a mismatch. The publish job waits for
`verify`, performs its own frozen install and build, and runs
`npm publish --access public` from that tagged checkout. It packages the tagged
files itself; the local archive is the reviewed candidate, not a separate
manually uploaded release.

Wait for the tag workflow's successful publish job, then query the actual
registry version:

```sh
bun pm view @speleodb/api@0.5.1 name version dist.integrity
```

Use the actual release version. Inspect the published archive's file list,
contents and `openapi-source.json` against the reviewed candidate; gzip/archive
metadata may differ between Bun's local pack and npm's CI pack. A failed SDK
verification job, absent trusted publisher, or rejected OIDC publication leaves
the release incomplete. Repair the specific gate and rerun the failed workflow;
do not weaken checks, move an existing release tag or fabricate registry
metadata.

Once the registry version is available, update the exact `@speleodb/api` pin in
both application manifests. From the monorepo root, resolve their independent
locks and then integration:

```sh
(cd apps/web && bun run lock)
(cd apps/mobile && bun run lock)
bun run lock
docker exec -w /app speleodb-monorepo-django \
  bun /workspace/.devcontainer/install-web-packages.mjs --refresh-lock
```

Review each lock diff, verify frozen installs in isolated standalone copies, and
rerun each application's own types, lint, tests and build. Run root `bun ci`
separately for integration. Successful archive checks establish package
contents; these registry-backed checks establish that standalone consumers can
reproduce the release. Follow the repository's explicit Git authorization rules
when recording or publishing any resulting commits.

## Troubleshooting

| Failure                                      | Resolution                                                                                                                          |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Invalid regex or unresolved schema reference | Fix the backend export, preserve match semantics, and re-export; do not disable validation                                          |
| Nullable `$ref` warning                      | Preserve the required non-null shape and use the backend exporter's explicit null alternative; reference siblings alone are ignored |
| File bytes disappear                         | Use the multipart variant and File/Blob input; inspect generated serialization and source media declarations                        |
| Duplicate or missing generated names         | Correct operation IDs and collisions in the source exporter                                                                         |
| Regeneration changes every file              | Verify exact Bun/Orval/formatter versions and stable export ordering                                                                |
| Unexpected response branch                   | Inspect status/media against the backend contract; do not cast away unknown data                                                    |
| Native request outlives timeout              | Move asynchronous preparation inside the deadline and honor the provided signal                                                     |
| Standalone install reports package not found | Check whether the SDK version has been published; local workspace success does not remove the release gate                          |
| Root and child locks differ                  | Resolve the standalone graph in isolation, then refresh the root integration and web overlay separately                             |
| Local schema hash mismatch                   | Review `OpenAPI.yaml` and deliberately update its digest before regenerating; never silently accept changed bytes                   |
| Local schema snapshot is missing             | Restore the reviewed `OpenAPI.yaml` through an authorized import; generation does not fetch a substitute                            |

Keep durable contract explanations here or in backend/application docs.
Temporary task notes, verification logs and investigation files belong outside
checkouts.
