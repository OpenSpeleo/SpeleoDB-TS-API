import { describe, expect, it } from "vitest";
import { unionFormData, unionUrlEncoded } from "./form-data";

describe.each([unionFormData, unionUrlEncoded])(
  "form field semantics",
  (serialize) => {
    it("creates an empty request when the optional body is absent", () => {
      expect([...serialize().entries()]).toEqual([]);
      expect([...serialize({}).entries()]).toEqual([]);
    });

    it("serializes object values once and preserves defined repeated scalar fields", () => {
      const object = { label: "Café 🦇", nested: { value: null } };
      const body = serialize({
        object,
        repeated: [undefined, 0, false, ""],
        empty: [],
      });
      expect(body.get("object")).toBe(JSON.stringify(object));
      expect(body.getAll("repeated")).toEqual(["0", "false", ""]);
      expect(body.has("empty")).toBe(false);
    });

    it("distinguishes an omitted update from an explicit nullable-field clear", () => {
      const body = serialize(
        { project: null, label: undefined, enabled: false, distance: 0 },
        ["project"],
      );
      expect(body.get("project")).toBe("");
      expect(body.has("label")).toBe(false);
      expect(body.get("enabled")).toBe("false");
      expect(body.get("distance")).toBe("0");
    });

    it("rejects unrepresentable null rather than silently dropping an update", () => {
      expect(() => serialize({ label: null })).toThrow("cannot represent null");
      expect(() => serialize({ tags: [null] }, ["tags"])).toThrow(
        "cannot represent null",
      );
    });

    it("preserves JSON-encoded form fields without double encoding", () => {
      const body = serialize({
        config: '{"label":"Café 🦇","items":[1,null]}',
        empty: "null",
        tags: ["a", "b"],
      });
      expect(body.get("config")).toBe('{"label":"Café 🦇","items":[1,null]}');
      expect(body.get("empty")).toBe("null");
      expect(body.getAll("tags")).toEqual(["a", "b"]);
    });
  },
);

it("preserves repeated multipart file names, types and independent bytes", async () => {
  const first = new File(["Café 🦇"], "first.txt", {
    type: "text/plain;charset=utf-8",
  });
  const second = new File([new Uint8Array([0, 255])], "second.bin", {
    type: "application/octet-stream",
  });
  const body = unionFormData({ files: [first, second] });
  const files = body.getAll("files") as File[];
  expect(files.map((file) => [file.name, file.type])).toEqual([
    ["first.txt", "text/plain;charset=utf-8"],
    ["second.bin", "application/octet-stream"],
  ]);
  expect(await files[0]!.text()).toBe("Café 🦇");
  expect(new Uint8Array(await files[1]!.arrayBuffer())).toEqual(
    new Uint8Array([0, 255]),
  );
});

it.each([{ file: new Blob(["bytes"]) }, { file: [new Blob(["bytes"])] }])(
  "rejects binary values in URL-encoded requests",
  ({ file }) => {
    expect(() => unionUrlEncoded({ file })).toThrow(
      "Files require multipart/form-data.",
    );
  },
);
