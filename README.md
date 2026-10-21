# @speleodb/api

The generated TypeScript SDK for SpeleoDB's current APIs. OpenAPI owns endpoint
paths, methods, parameters, request bodies and response models. A small runtime
provides browser networking and an injectable transport for Capacitor and other
hosts. Obsolete SpeleoDB `/api/v1` operations are excluded by an exact
path-prefix filter even when present in the input export. Authentication's own
`/v1` paths remain supported.

This package distributes TypeScript source. Bun and application bundlers import
`@speleodb/api` directly; there is no prerequisite build and no runtime
dependency on Orval, Axios, React or Capacitor. Development uses Bun 1.4.2.

## Clients and operations

Create a client for an instance, then pass it in the final options argument of
every generated operation. `src/generated/operations.ts` exports the operation
functions and their URL helpers; generated models are exported from the package
root. The client has no global token or mutable singleton configuration.

```ts
import { createApiClient } from "@speleodb/api";

const client = createApiClient({
  baseUrl: "https://www.speleodb.org",
  headers: () => ({ Authorization: `Token ${readCurrentToken()}` }),
});
// generatedOperation(generatedArguments, { client, signal });
```

Header providers run for each request, including offline replay. Browser apps
using session authentication can provide their CSRF header from this callback
and set `credentials: 'same-origin'`. Authentication and cache policy stay in
the application. The base URL is an origin without a path, query or fragment;
generated paths retain the paths declared in OpenAPI. Generated request URLs
must remain on that origin; redirect handling follows the transport's requested
policy. Header names are merged case-insensitively: generated operation defaults
override client headers, and explicit per-call headers override those defaults.
A `Headers` object, tuple list, or record has the same precedence.

Orval currently emits an optional final options parameter even though this
runtime requires `client`. Omitting it fails before transport. Operation
metadata is supplied by generated code and must not be overridden by callers.

## Results, cancellation and uploads

HTTP responses resolve with `status`, `data`, `headers` and `kind`. Narrow
`kind === 'documented'` before using the generated status-correlated DTO. An
undeclared status, unexpected media type, or unparsed error body returns
`kind === 'unexpected'` with `data: unknown`; its HTTP status remains available.
These types do not constitute runtime schema validation.

Transport failures, caller cancellation, invalid successful JSON and deadlines
reject. The default deadline is ten seconds and includes dynamic headers,
transport and response decoding. A per-call `timeoutMs` overrides it. Custom
transports receive the remaining deadline and its signal; late completions
cannot publish a result. There are no automatic retries.

Set `timeoutMs: null` on a client or individual call to explicitly disable its
deadline while retaining caller cancellation. Omitting the option inherits the
client policy; a finite per-call value can bound an otherwise untimed client.
Web explicitly uses the no-deadline policy to preserve its existing large-upload
and conversion behavior. Mobile retains its finite ten-second policy.

JSON is serialized by generated code exactly once. Multipart operations accept
the generated body model containing `File`/`Blob` values and produce FormData;
the browser owns its multipart boundary. Binary responses remain Blob values and
text responses remain strings. Empty responses, including HTTP 304, have
`data: undefined`.

Form inputs follow their own generated models. JSON-encoded form fields accept
strings from `JSON.stringify(value)`. Explicit nullable-field clears are encoded
using the backend's field policy; unsupported form nulls throw rather than
silently omitting an update. See the
[form maintenance guidance](docs/maintenance.md).

`onUploadProgress` or `onUploadComplete` selects the browser XHR transport. The
completion callback means request bytes have been uploaded; the server response
may still be pending. Without these callbacks, requests use fetch. XHR rejects
cookie omission and redirect-refusal policies it cannot enforce. The XHR adapter
also rejects `responsePolicy: 'status-first-json'` because it waits for the
complete response body before inspecting status. Use fetch for those operations;
the adapter never silently discards upload callbacks by switching transports.
Callback failures do not change the HTTP result.

## Native and custom transports

Pass `transport: async (request) => ({ status, data, headers })` to
`createApiClient`. `ApiTransportRequest` includes the absolute URL, generated
method and metadata, Headers, serialized body, AbortSignal, remaining timeout,
and optional upload callbacks. Preserve serialized JSON and FormData until the
platform adapter. Native multipart conversion must happen inside the supplied
deadline. A custom transport should set `unexpected: true` when it preserves a
status without obtaining the documented response body. An untimed request
supplies `timeoutMs: null`; browser fetch and XHR honor it. A custom transport
that requires finite deadlines must reject this policy explicitly instead of
silently substituting a timeout. Mobile's adapter does so.

Mobile keeps its existing Capacitor transport, HTTPS policy, native user agents,
multipart protection, session lifecycle and offline persistence. GIS reads use
`responsePolicy: 'status-first-json'` and `cookiePolicy: 'omit'`: denial
statuses are returned without consuming error bodies, and successful bodies
require JSON. The first-party mobile GIS plugin remains responsible for native
cookie isolation and cancellation. Presigned storage downloads, map tiles and
static assets are not generated API operations and must not inherit API
credentials.

## Contract and regeneration

This repository owns the checked-in `OpenAPI.yaml` snapshot used to generate the
SDK. `openapi-source.json` records its SHA-256. Generation reads and verifies
these package-local files; it does not fetch a schema or require another
repository, backend commit, or environment override. Both files are included in
the npm package.

```sh
test -s bun.lock && bun install --frozen-lockfile
bun run generate
bun run check
```

Orval is pinned to 8.43.0. Response metadata comes from the same verified local
snapshot; there is no separately maintained route registry. To adopt an API
change, manually import the reviewed OpenAPI export into `OpenAPI.yaml`, update
its digest, and regenerate. Schema imports are deliberate SDK changes, separate
from backend and consumer releases. Backend contract tests establish server
correctness; a generated SDK alone is not evidence of that audit.

Never edit `src/generated/` or `src/form-data.generated.ts` manually: correct
the schema or generation inputs and regenerate. `generate:check` reproduces
output in a temporary directory and compares bytes and filenames without
modifying source. A clean standalone checkout contains everything required for
schema verification and generation once its dependencies are installed. The
monorepo separately checks that its local web and SDK snapshots and the recorded
digest agree; this integration check does not couple standalone CI or releases.

`bun run test` uses Vitest with Istanbul runtime coverage. A schema-derived
loopback HTTP matrix exercises all 376 supported operations, 584 generated
request variants and 1,869 declared status/media combinations. It verifies
request bytes, complete response metadata, decoding and unexpected responses.
Focused tests cover cancellation, streaming, redirects, credentials, forms, XHR
adapter events and generation safety. CI verifies generation, strict types,
lint, formatting, tests, a bundle smoke build and the package file list. A
pushed `v<package.json version>` tag publishes after verification passes.
Publication uses the same npm trusted publishing workflow as the other SpeleoDB
TypeScript packages.

Configure `@speleodb/api` on npmjs.com with a GitHub Actions trusted publisher
for organization `OpenSpeleo`, repository `SpeleoDB-TS-API`, workflow filename
`ci.yml`, environment name `publish`, label `github`, and permission to run
`npm publish`. The job uses GitHub OIDC; no npm write token is needed. Bun owns
dependency installation, checks and builds; Node 24 and npm are used only by the
publishing job. The GitHub environment and npm trust must be configured before
pushing a release tag. An unpublished package's initial registry setup remains a
release prerequisite; a successful local registry login does not establish
trusted publishing readiness.

Consumer standalone release validation requires an available registry version or
an explicitly reviewed package archive. An unpublished package must not be
represented by invented registry metadata.

See [Maintaining the SDK](docs/maintenance.md) for the complete contract update,
regeneration, testing, dependency and release workflow.
