import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import {
  createApiClient,
  v2ImportGpxUpdate,
  v2GisGeometriesCreateWithFormData,
  v2GisGeometriesCreateWithUrlEncoded,
  v2CylinderInstallsPartialUpdateWithFormData,
  v2CylinderInstallsPartialUpdateWithUrlEncoded,
  v2CylinderInstallsPartialUpdateWithJson,
  v2ProjectsPartialUpdateWithUrlEncoded,
  v2ProjectsDownloadRetrieveByFormatAtHash,
  v2ProjectsUpload,
  v2StationsPartialUpdateWithFormData,
  v2UserAuthTokenCreateWithJson,
  v2UserAuthTokenCreateWithUrlEncoded,
  v2UserAutocompleteList,
} from "../index";
import type { ApiTransportRequest } from "./types";

afterEach(() => vi.restoreAllMocks());

describe("generated operation integration", () => {
  it.each([
    ["headers", "json"],
    ["record", "json"],
    ["tuples", "json"],
    ["headers", "urlencoded"],
    ["record", "urlencoded"],
    ["tuples", "urlencoded"],
  ] as const)(
    "merges generated and caller Content-Type case-insensitively for %s/%s",
    async (shape, media) => {
      const contentType =
        media === "json"
          ? "application/json; charset=utf-8"
          : "application/x-www-form-urlencoded; charset=utf-8";
      const entries: [string, string][] = [
        ["content-type", contentType],
        ["x-trace", "caller"],
      ];
      const headers: HeadersInit =
        shape === "headers"
          ? new Headers(entries)
          : shape === "record"
            ? Object.fromEntries(entries)
            : entries;
      const transport = vi.fn(async (request: ApiTransportRequest) => {
        expect(request.headers.get("content-type")).toBe(contentType);
        expect(request.headers.get("x-trace")).toBe("caller");
        const body =
          media === "json"
            ? (JSON.parse(String(request.body)) as unknown)
            : Object.fromEntries(new URLSearchParams(String(request.body)));
        expect(body).toEqual({
          email: "person@example.test",
          password: "secret",
        });
        return {
          status: 200,
          data: {},
          headers: new Headers({ "content-type": "application/json" }),
        };
      });
      const client = createApiClient({
        baseUrl: "https://example.test",
        headers: {
          "Content-Type": "application/problem+json",
          "X-Trace": "client",
        },
        transport,
      });
      const invoke =
        media === "json"
          ? v2UserAuthTokenCreateWithJson
          : v2UserAuthTokenCreateWithUrlEncoded;
      await invoke(
        { email: "person@example.test", password: "secret" },
        undefined,
        { client, headers },
      );
      expect(transport).toHaveBeenCalledOnce();
    },
  );

  it("serializes nested geometry as JSON in both supported form representations", async () => {
    const geometry = {
      type: "LineString" as const,
      coordinates: [
        [-71, 12],
        [-70, 13],
      ],
    };
    const bodies: Array<FormData | URLSearchParams> = [];
    const client = createApiClient({
      baseUrl: "https://example.test",
      transport: async (request) => {
        bodies.push(
          typeof request.body === "string"
            ? new URLSearchParams(request.body)
            : (request.body as FormData),
        );
        return {
          status: 201,
          data: {},
          headers: new Headers({ "content-type": "application/json" }),
        };
      },
    });
    await v2GisGeometriesCreateWithFormData(
      { name: "Café 🦇", geojson: JSON.stringify(geometry) },
      undefined,
      { client },
    );
    await v2GisGeometriesCreateWithUrlEncoded(
      { name: "Café 🦇", geojson: JSON.stringify(geometry) },
      undefined,
      { client },
    );
    for (const body of bodies) {
      expect(body.get("name")).toBe("Café 🦇");
      expect(JSON.parse(body.get("geojson") as string)).toEqual(geometry);
    }
  });

  it("clears nullable fields through every generated request representation", async () => {
    const bodies: ApiTransportRequest["body"][] = [];
    const client = createApiClient({
      baseUrl: "https://example.test",
      transport: async (request) => {
        bodies.push(request.body);
        return {
          status: 200,
          data: {},
          headers: new Headers({ "content-type": "application/json" }),
        };
      },
    });
    const update = { distance_from_entry: null, uninstall_date: null };
    await v2CylinderInstallsPartialUpdateWithFormData(
      "install",
      update,
      undefined,
      { client },
    );
    await v2CylinderInstallsPartialUpdateWithUrlEncoded(
      "install",
      update,
      undefined,
      { client },
    );
    await v2CylinderInstallsPartialUpdateWithJson(
      "install",
      update,
      undefined,
      { client },
    );
    expect([...(bodies[0] as FormData).entries()]).toEqual([
      ["distance_from_entry", ""],
      ["uninstall_date", ""],
    ]);
    expect([...new URLSearchParams(String(bodies[1])).entries()]).toEqual([
      ["distance_from_entry", ""],
      ["uninstall_date", ""],
    ]);
    expect(JSON.parse(String(bodies[2]))).toEqual(update);
  });

  it("serializes numeric and string coordinate inputs without double encoding", async () => {
    const transport = vi.fn(async (request: ApiTransportRequest) => {
      expect(request.headers.get("content-type")).toBe(
        "application/x-www-form-urlencoded",
      );
      const encoded = new Request(request.url, {
        method: request.method,
        headers: request.headers,
        ...(request.body !== undefined ? { body: request.body } : {}),
      });
      expect(await encoded.text()).toBe("latitude=0&longitude=-71.25");
      return {
        status: 200,
        data: {},
        headers: new Headers({ "content-type": "application/json" }),
      };
    });
    const client = createApiClient({
      baseUrl: "https://example.test",
      transport,
    });
    await v2ProjectsPartialUpdateWithUrlEncoded(
      "project",
      { latitude: 0, longitude: "-71.25" },
      undefined,
      { client },
    );
    expect(transport).toHaveBeenCalledOnce();
  });

  it("uses generated JSON serialization and status metadata through the public package", async () => {
    const transport = vi.fn(async (request: ApiTransportRequest) => {
      expect(request.method).toBe("POST");
      expect(request.url).toBe(
        "https://example.test/api/v2/user/auth-token/?format=json",
      );
      expect(request.headers.get("content-type")).toBe("application/json");
      expect(request.body).toBe(
        '{"email":"café@example.test","password":"secret"}',
      );
      expect(request.operation.operationId).toBe("v2_user_auth_token_create");
      return {
        status: 400,
        data: { detail: "Invalid credentials." },
        headers: new Headers({ "content-type": "application/json" }),
      };
    });
    const client = createApiClient({
      baseUrl: "https://example.test",
      transport,
    });
    const result = await v2UserAuthTokenCreateWithJson(
      { email: "café@example.test", password: "secret" },
      { format: "json" },
      { client },
    );
    expect(result).toMatchObject({ kind: "documented", status: 400 });
    expect(transport).toHaveBeenCalledOnce();
    if (result.kind === "unexpected")
      expectTypeOf(result.data).toEqualTypeOf<unknown>();
  });

  it("preserves generated multipart filenames, MIME, UTF-8 bytes and collection metadata", async () => {
    const transport = vi.fn(async (request: ApiTransportRequest) => {
      expect(request.method).toBe("PUT");
      expect(request.url).toBe("https://example.test/api/v2/import/gpx/");
      expect(request.headers.has("content-type")).toBe(false);
      expect(request.body).toBeInstanceOf(FormData);
      const form = request.body as FormData;
      const file = form.get("file") as File;
      expect(file.name).toBe("survey.gpx");
      expect(file.type).toBe("application/gpx+xml");
      expect(await file.text()).toBe("<gpx>Café 🦇</gpx>");
      expect(form.get("collection")).toBe("collection-id");
      return {
        status: 200,
        data: {},
        headers: new Headers({ "content-type": "application/json" }),
      };
    });
    const client = createApiClient({
      baseUrl: "https://example.test",
      transport,
    });
    await v2ImportGpxUpdate(
      {
        file: new File(["<gpx>Café 🦇</gpx>"], "survey.gpx", {
          type: "application/gpx+xml",
        }),
        collection: "collection-id",
      },
      undefined,
      { client },
    );
    expect(transport).toHaveBeenCalledOnce();
  });

  it("retains repeated artifact fields and documented 304 without a payload", async () => {
    const transport = vi.fn(async (request: ApiTransportRequest) => {
      const form = request.body as FormData;
      expect(
        (form.getAll("artifact") as File[]).map((file) => file.name),
      ).toEqual(["first.dat", "second.dat"]);
      expect(form.get("message")).toBe("Update survey");
      return { status: 304, data: undefined, headers: new Headers() };
    });
    const client = createApiClient({
      baseUrl: "https://example.test",
      transport,
    });
    const result = await v2ProjectsUpload(
      "project",
      "format",
      {
        artifact: [new File(["1"], "first.dat"), new File(["2"], "second.dat")],
        message: "Update survey",
      },
      undefined,
      { client },
    );
    expect(result).toMatchObject({
      kind: "documented",
      status: 304,
      data: undefined,
    });
    if (result.kind === "documented" && result.status === 304)
      expectTypeOf(result.data).toEqualTypeOf<void>();
  });

  it("serializes union multipart scalars through the configured browser-safe mutator", async () => {
    const transport = vi.fn(async (request: ApiTransportRequest) => {
      const form = request.body as FormData;
      expect([...form.entries()]).toEqual([
        ["name", "Station α"],
        ["latitude", "12.5"],
        ["longitude", "-71.25"],
      ]);
      return {
        status: 200,
        data: {},
        headers: new Headers({ "content-type": "application/json" }),
      };
    });
    const client = createApiClient({
      baseUrl: "https://example.test",
      transport,
    });
    await v2StationsPartialUpdateWithFormData(
      "station",
      { name: "Station α", latitude: 12.5, longitude: -71.25 },
      undefined,
      { client },
    );
    expect(transport).toHaveBeenCalledOnce();
  });

  it("encodes path/query arguments and decodes binary responses with their headers", async () => {
    const fetcher = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(new Uint8Array([0, 255, 5]), {
          headers: {
            "content-type": "application/octet-stream",
            "content-disposition": 'attachment; filename="survey.zip"',
          },
        }),
      )
      .mockResolvedValueOnce(
        new Response("[]", { headers: { "content-type": "application/json" } }),
      );
    const client = createApiClient({ baseUrl: "https://example.test" });
    const result = await v2ProjectsDownloadRetrieveByFormatAtHash(
      "id /é",
      "zip",
      "hash?#",
      undefined,
      { client },
    );
    expect(fetcher.mock.calls[0]?.[0]).toBe(
      "https://example.test/api/v2/projects/id%20%2F%C3%A9/download/zip/hash%3F%23/",
    );
    expect(result.kind).toBe("documented");
    expect(result.headers.get("content-disposition")).toContain("survey.zip");
    if (result.kind === "documented" && result.status === 200) {
      expectTypeOf(result.data).toEqualTypeOf<Blob>();
      expect(new Uint8Array(await result.data.arrayBuffer())).toEqual(
        new Uint8Array([0, 255, 5]),
      );
    } else throw new Error("Expected a documented binary response.");
    await v2UserAutocompleteList({ query: "café & cave" }, { client });
    expect(fetcher.mock.calls[1]?.[0]).toBe(
      "https://example.test/api/v2/user/autocomplete/?query=caf%C3%A9+%26+cave",
    );
  });
});
