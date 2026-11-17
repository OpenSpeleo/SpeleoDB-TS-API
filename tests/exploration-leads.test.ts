import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { expect, it } from "vitest";
import {
  createApiClient,
  v2ExplorationLeadsPartialUpdateWithFormData,
  v2ExplorationLeadsPartialUpdateWithJson,
  v2ExplorationLeadsPartialUpdateWithUrlEncoded,
} from "../src/index";

it.each([
  undefined,
  [{ heading: null, checked: true }],
  [
    { heading: 22.5, checked: true },
    { heading: 270, checked: false },
  ],
])(
  "preserves direction omission, null bearings and checked states across request encodings: %j",
  async (directions) => {
    const received: { media: string; directions: unknown }[] = [];
    const server = createServer((request, response) => {
      void (async () => {
        const chunks: Buffer[] = [];
        for await (const chunk of request)
          chunks.push(Buffer.from(chunk as Uint8Array));
        const bytes = Buffer.concat(chunks);
        const media = request.headers["content-type"]!;
        let value: unknown;
        if (media.startsWith("application/json")) {
          value = (JSON.parse(bytes.toString()) as { directions?: unknown })
            .directions;
        } else if (media.startsWith("multipart/form-data")) {
          const form = await new Response(bytes, {
            headers: { "Content-Type": media },
          }).formData();
          value = form.has("directions") ? form.get("directions") : undefined;
        } else {
          const form = new URLSearchParams(bytes.toString());
          value = form.has("directions") ? form.get("directions") : undefined;
        }
        received.push({ media, directions: value });
        // This real loopback fixture verifies request bytes. The backend suite
        // verifies validation and persisted reset/omission behavior separately.
        response.writeHead(400, { "Content-Type": "application/json" });
        response.end(JSON.stringify({ detail: "transport fixture" }));
      })().catch(() => response.writeHead(500).end());
    });
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    try {
      const client = createApiClient({
        baseUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
      });
      const body = {
        description: "Keep the field notes",
        ...(directions === undefined ? {} : { directions }),
      };
      const formBody = {
        description: body.description,
        ...(directions === undefined
          ? {}
          : { directions: JSON.stringify(directions) }),
      };
      await v2ExplorationLeadsPartialUpdateWithJson("lead", body, undefined, {
        client,
      });
      await v2ExplorationLeadsPartialUpdateWithFormData(
        "lead",
        formBody,
        undefined,
        { client },
      );
      await v2ExplorationLeadsPartialUpdateWithUrlEncoded(
        "lead",
        formBody,
        undefined,
        { client },
      );
      expect(received.map((request) => request.directions)).toEqual([
        directions,
        formBody.directions,
        formBody.directions,
      ]);
      expect(received[0]!.media).toContain("application/json");
      expect(received[1]!.media).toContain("multipart/form-data");
      expect(received[2]!.media).toContain("application/x-www-form-urlencoded");
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
        server.closeAllConnections();
      });
    }
  },
);
